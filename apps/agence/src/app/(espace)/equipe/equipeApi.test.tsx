import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/app/providers";
import InvitationApiPage from "./inviter/page";
import RolesPage from "./roles/page";

const ORG = "01934f6e-0000-7000-8000-00000000000b";
const org = (path = "") => `/api/v1/org/${ORG}${path}`;

const state = vi.hoisted((): { mode: "demo" | "api" } => ({ mode: "api" }));

vi.mock("@/lib/env", () => ({
  get dataSource() {
    return state.mode;
  },
  apiEnv: () => ({ NEXT_PUBLIC_API_URL: "https://api.test", NEXT_PUBLIC_AUTH_URL: "https://auth.test", NEXT_PUBLIC_DATA_SOURCE: state.mode }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/equipe/roles",
  notFound: () => {
    throw new Error("notFound");
  },
}));

const roles = {
  data: {
    current_role: "admin",
    domains: [
      { key: "mandates", levels: { owner: "write", admin: "write", manager: "write", accountant: "read" }, two_factor: false },
      { key: "owner_funds_sensitive", levels: { owner: "write_two_factor", admin: "write_two_factor", manager: "none", accountant: "write_two_factor" }, two_factor: true },
    ],
  },
};
const team = {
  data: [
    {
      id: "01934f6e-0000-7000-8000-0000000000b1",
      first_name: "Jeanne",
      last_name: "Dupont",
      email: "jeanne.dupont@example.com",
      role: "owner",
      status: "active",
      scope: { type: "all", property_ids: [] },
      two_factor: "enabled",
      last_login_at: "2026-11-16T08:30:00+00:00",
      invited_at: null,
      joined_at: "2026-11-01T09:00:00+00:00",
      message: null,
      self: true,
    },
  ],
  meta: { two_factor_required: false, seat_limit: null },
};

function stubApi(extra: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const routes: Record<string, unknown> = {
    "/api/v1/me/profiles": { data: [{ space: "organization", label: "Agence Soleil", meta: { organization: ORG, kind: "agency", role: "admin" } }] },
    [org()]: { data: { id: ORG, kind: "agency", name: "Agence Soleil", country: "FR", currency: "EUR", timezone: "Europe/Paris", two_factor_required: false } },
    [org("/roles")]: roles,
    [org("/members")]: team,
    ...extra,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>((input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
      calls.push(`${init?.method ?? "GET"} ${url.pathname}`);
      const known = routes[`${init?.method === "POST" ? "POST " : ""}${url.pathname}`] ?? routes[url.pathname];
      if (known instanceof Response) return Promise.resolve(known);
      const body = known ?? { type: "about:blank", title: "Route non prévue", status: 500, code: "server_error" };
      return Promise.resolve(new Response(JSON.stringify(body), { status: known === undefined ? 500 : 200, headers: { "Content-Type": "application/json" } }));
    }),
  );
  return calls;
}

function renderWith(children: ReactNode) {
  return render(
    <Providers>
      <TooltipProvider>
        <ToastProvider>{children}</ToastProvider>
      </TooltipProvider>
    </Providers>,
  );
}

beforeEach(() => {
  state.mode = "api";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Rôles et droits en mode api", () => {
  it("lit la matrice du serveur et n'affiche pas la matrice de démonstration", async () => {
    const calls = stubApi();

    renderWith(<RolesPage />);

    const table = await screen.findByRole("table", { name: "Matrice des droits par rôle" });
    expect(within(table).getByText("Mandats, mandants et barème")).toBeTruthy();
    expect(within(table).getByRole("columnheader", { name: /Administrateur \(vous\)/ })).toBeTruthy();
    expect(within(table).queryByText("Assistante")).toBeNull();
    expect(calls).toContain(`GET ${org("/roles")}`);
    expect(calls.every((call) => call.startsWith("GET "))).toBe(true);
  });

  it("affiche l'erreur serveur avec Réessayer au lieu de la matrice de démonstration", async () => {
    stubApi({ [org("/roles")]: new Response(JSON.stringify({ code: "server_error", title: "Erreur", status: 500 }), { status: 500, headers: { "Content-Type": "application/json" } }) });

    renderWith(<RolesPage />);

    expect(await screen.findByText("Les droits des rôles n'ont pas pu être chargés", undefined, { timeout: 9000 })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  }, 15000);

  it("garde la matrice de démonstration en mode demo", async () => {
    state.mode = "demo";

    renderWith(<RolesPage />);

    expect(await screen.findByRole("table", { name: "Matrice des droits" })).toBeTruthy();
  });
});

describe("Invitation d'un membre en mode api", () => {
  it("n'offre pas le périmètre « Biens choisis » et affiche le refus 422 member_scope_unsupported", async () => {
    const calls = stubApi({
      "POST /api/v1/org/01934f6e-0000-7000-8000-00000000000b/members": new Response(
        JSON.stringify({ type: "about:blank", title: "Périmètre non appliqué", status: 422, code: "member_scope_unsupported", detail: "Texte serveur" }),
        { status: 422, headers: { "Content-Type": "application/problem+json" } },
      ),
    });

    renderWith(<InvitationApiPage />);

    await userEvent.type(await screen.findByLabelText("Prénom *"), "Ibrahim");
    expect(screen.queryByRole("radio", { name: "Biens choisis" })).toBeNull();
    await userEvent.type(screen.getByLabelText("Nom *"), "Yao");
    await userEvent.type(screen.getByLabelText("E-mail *"), "ibrahim.yao@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer l'invitation" }));

    expect(await screen.findByText(/n'est pas appliqué par le serveur : un membre y verrait tous les biens/)).toBeTruthy();
    expect(calls).toContain(`POST ${org("/members")}`);
  });
});
