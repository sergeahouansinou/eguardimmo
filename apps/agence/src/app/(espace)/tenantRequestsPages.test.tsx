import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "../providers";
import { EspaceShell } from "./EspaceShell";
import CongesPage from "./baux/conges/page";
import AssurancesPage from "./conformite/assurances/page";
import PaiementsPage from "./finances/paiements-en-ligne/page";

const ORG = "01934f6e-0000-7000-8000-00000000000b";
const FORBIDDEN = ["Sophie Delmas", "Cabinet Delmas", "Marc Chevalier", "Anaïs Roux", "Apt 12"];

const state = vi.hoisted((): { mode: "demo" | "api"; pathname: string } => ({ mode: "api", pathname: "/baux/conges" }));

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
  notFound: () => {
    throw new Error("notFound");
  },
}));

function stubApi(role: string) {
  const calls: string[] = [];
  const routes: Record<string, unknown> = {
    "/api/v1/me/profiles": { data: [{ space: "organization", label: "Agence Soleil", meta: { organization: ORG, kind: "agency", role } }] },
    "/api/v1/me": { data: { id: "01934f6e-0000-7000-8000-0000000000b1", name: "Jeanne Dupont", email: "jeanne.dupont@example.com", email_verified_at: "2026-11-01T09:00:00+00:00", last_login_at: "2026-11-16T08:30:00+00:00", previous_login_at: null } },
    [`/api/v1/org/${ORG}`]: { data: { id: ORG, kind: "agency", name: "Agence Soleil", country: "FR", currency: "EUR", timezone: "Europe/Paris", two_factor_required: false } },
    [`/api/v1/org/${ORG}/conversations/unread`]: { data: { internal: 0, tenant: 0, owner: 0 } },
    "/api/v1/notifications/unread-count": { data: { unread: 0 } },
    "/api/v1/notifications": { data: [], meta: { next_cursor: null } },
    [`/api/v1/org/${ORG}/notice-requests`]: { data: [], links: {}, meta: { per_page: 25, next_cursor: null, prev_cursor: null } },
  };
  const fetchMock = vi.fn<typeof fetch>((input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    calls.push(url.pathname);
    const known = routes[url.pathname];
    const body = known ?? { type: "about:blank", title: "Route non prévue", status: 500, code: "server_error" };
    return Promise.resolve(new Response(JSON.stringify(body), { status: known === undefined ? 500 : 200, headers: { "Content-Type": "application/json" } }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

function renderPage(page: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <Providers>
      <QueryClientProvider client={client}>
        <EspaceShell>{page}</EspaceShell>
      </QueryClientProvider>
    </Providers>,
  );
}

beforeEach(() => {
  state.mode = "api";
  state.pathname = "/baux/conges";
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("pages des demandes des locataires en mode démonstration", () => {
  it.each([
    ["congés", CongesPage],
    ["assurances", AssurancesPage],
    ["paiements en ligne", PaiementsPage],
  ])("la page %s répond 404", (_name, Page) => {
    state.mode = "demo";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Page />)).toThrow("notFound");
  });
});

describe("pages des demandes des locataires en mode api", () => {
  it("refuse proprement la page des congés au comptable, sans appeler la liste", async () => {
    const calls = stubApi("accountant");

    renderPage(<CongesPage />);

    expect(await screen.findByText("Page indisponible pour votre rôle")).toBeTruthy();
    expect(calls).not.toContain(`/api/v1/org/${ORG}/notice-requests`);
    for (const text of FORBIDDEN) expect(document.body.textContent).not.toContain(text);
  });

  it("refuse la page des assurances au comptable", async () => {
    state.pathname = "/conformite/assurances";
    stubApi("accountant");

    renderPage(<AssurancesPage />);

    expect(await screen.findByText("Page indisponible pour votre rôle")).toBeTruthy();
  });

  it("charge la liste des congés pour un gestionnaire", async () => {
    const calls = stubApi("manager");

    renderPage(<CongesPage />);

    expect(await screen.findByRole("heading", { level: 1, name: /congé/i })).toBeTruthy();
    expect(screen.queryByText("Page indisponible pour votre rôle")).toBeNull();
    await vi.waitFor(() => { expect(calls).toContain(`/api/v1/org/${ORG}/notice-requests`); });
    for (const text of FORBIDDEN) expect(document.body.textContent).not.toContain(text);
  });
});
