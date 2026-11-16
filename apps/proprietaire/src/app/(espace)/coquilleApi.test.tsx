import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EspaceShell } from "./EspaceShell";
import { Providers } from "../providers";

const ORG = "01934f6e-0000-7000-8000-00000000000a";

const state = vi.hoisted((): { mode: "demo" | "api"; pathname: string } => ({ mode: "api", pathname: "/" }));

vi.mock("@/lib/env", () => ({
  get dataSource() {
    return state.mode;
  },
  apiEnv: () => ({ NEXT_PUBLIC_API_URL: "https://api.test", NEXT_PUBLIC_AUTH_URL: "http://localhost:3040", NEXT_PUBLIC_DATA_SOURCE: state.mode }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => state.pathname,
}));

const FORBIDDEN = ["Marc Chevalier", "Gestion Les Tilleuls", "Awa Diallo", "Essentiel", "Visa 4242"];

function stubApi(extra: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const routes: Record<string, unknown> = {
    "/api/v1/me/profiles": { data: [{ space: "organization", label: "Dupont Gestion", meta: { organization: ORG, kind: "individual", role: "owner" } }] },
    "/api/v1/me": {
      data: {
        id: "01934f6e-0000-7000-8000-0000000000a1",
        name: "Jeanne Dupont",
        email: "jeanne.dupont@example.com",
        email_verified_at: "2026-11-01T09:00:00+00:00",
        last_login_at: "2026-11-16T08:30:00+00:00",
        previous_login_at: null,
      },
    },
    [`/api/v1/org/${ORG}`]: { data: { id: ORG, kind: "individual", name: "Dupont Gestion", country: "FR", two_factor_required: false } },
    [`/api/v1/org/${ORG}/conversations/stats`]: { data: { unread: 3, stale: 0 } },
    ...extra,
  };
  const fetchMock = vi.fn<typeof fetch>((input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    calls.push(url.pathname);
    const known = routes[url.pathname];
    const body = known ?? { type: "about:blank", title: "Route non prévue", status: 500, code: "server_error" };
    const status = known === undefined ? 500 : 200;
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

function renderEspace(children: React.ReactNode = <p>Contenu réel</p>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <Providers>
      <QueryClientProvider client={client}>
        <EspaceShell>{children}</EspaceShell>
      </QueryClientProvider>
    </Providers>,
  );
}

beforeEach(() => {
  state.mode = "api";
  state.pathname = "/";
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("coquille de l'espace bailleur en mode api", () => {
  it("affiche l'utilisateur et l'organisation du serveur, sans aucune donnée de démonstration", async () => {
    stubApi();
    state.pathname = "/biens";

    renderEspace();

    const account = await screen.findByRole("button", { name: "Compte, espace de travail Dupont Gestion" });
    await userEvent.click(account);
    const menu = await screen.findByRole("menu", { name: "Menu du compte" });
    expect(within(menu).getByText("Jeanne Dupont")).toBeTruthy();
    expect(within(menu).getByText("jeanne.dupont@example.com")).toBeTruthy();
    expect(within(menu).getByText("Titulaire")).toBeTruthy();
    expect(within(menu).queryByText(/Espace de /)).toBeNull();
    expect(within(menu).queryByText(/membres/)).toBeNull();

    for (const text of FORBIDDEN) expect(document.body.textContent).not.toContain(text);
  });

  it("n'affiche que le compteur de messages non lus réel, sans compteur inventé", async () => {
    stubApi();
    state.pathname = "/biens";

    renderEspace();

    const side = await screen.findByRole("navigation", { name: "Navigation principale" });
    expect(await within(side).findByRole("link", { name: /Messages\s*3$/ })).toBeTruthy();
    expect(within(side).queryByRole("button", { name: /Biens\s*\d/ })).toBeNull();
    expect(within(side).queryByRole("button", { name: /Locataires\s*\d/ })).toBeNull();
    expect(within(side).queryByRole("link", { name: /Interventions\s*\d/ })).toBeNull();
  });

  it("n'a aucune notification et le dit", async () => {
    stubApi();
    state.pathname = "/biens";

    renderEspace();

    await screen.findByRole("button", { name: "Compte, espace de travail Dupont Gestion" });
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    const panel = await screen.findByRole("dialog", { name: "Notifications" });
    expect(within(panel).getByText("Aucune notification.")).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Tout marquer comme lu" }).hasAttribute("disabled")).toBe(true);
    for (const text of FORBIDDEN) expect(document.body.textContent).not.toContain(text);
  });

  it("signale l'échec du chargement du compte au lieu d'afficher un compte de démonstration", async () => {
    stubApi({ "/api/v1/me": undefined });
    state.pathname = "/biens";

    renderEspace();

    expect(await screen.findByText("Le compte n’a pas pu être chargé")).toBeTruthy();
    for (const text of FORBIDDEN) expect(document.body.textContent).not.toContain(text);
  });

  it("garde la coquille de démonstration inchangée en mode démo", async () => {
    state.mode = "demo";
    const calls = stubApi();

    renderEspace();

    expect(await screen.findByRole("button", { name: "Compte, espace de travail Gestion Les Tilleuls" })).toBeTruthy();
    await waitFor(() => { expect(calls.some((path) => path.includes("/api/v1/me"))).toBe(false); });
  });
});
