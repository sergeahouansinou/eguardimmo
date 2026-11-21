import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "../providers";
import { EspaceShell } from "./EspaceShell";
import DevisRoute from "./devis/page";

const ORG = "01934f6e-0000-7000-8000-00000000000b";
const INTERVENTION = "01934f6e-0000-7000-8000-0000000000c1";
const SUPPLIER_PARTY = "01934f6e-0000-7000-8000-0000000000c2";

const state = vi.hoisted((): { mode: "demo" | "api" } => ({ mode: "api" }));

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
  usePathname: () => "/interventions",
  notFound: () => {
    throw new Error("notFound");
  },
}));

const money = (amount: number) => ({ amount, currency: "EUR" });
const quote = {
  id: "01934f6e-0000-7000-8000-0000000000c3",
  intervention_id: INTERVENTION,
  supplier_party_id: SUPPLIER_PARTY,
  reference: "DEV-2026-0007",
  kind: "initial",
  status: "submitted",
  issued_on: "2026-11-17",
  valid_until: "2026-12-31",
  proposed_on: null,
  message: null,
  total_net: money(60000),
  total_tax: money(12000),
  total_gross: money(72000),
  lock_version: 2,
  intervention: { id: INTERVENTION, reference: "INT-2026-0042", status: "awaiting_approval", unit_id: null },
  approval: { status: "pending", ceiling_amount: money(50000), decide_before: "2026-11-20T11:01:00+00:00" },
};
const page = (data: unknown[]) => ({ data, links: { first: null, last: null, prev: null, next: null }, meta: { per_page: 25, next_cursor: null, prev_cursor: null } });

function stubApi(quotes: { status: number; body: unknown }) {
  const calls: string[] = [];
  const routes: Record<string, { status: number; body: unknown }> = {
    "/api/v1/me/profiles": { status: 200, body: { data: [{ space: "organization", label: "Agence Soleil", meta: { organization: ORG, kind: "agency", role: "accountant" } }] } },
    "/api/v1/me": { status: 200, body: { data: { id: "01934f6e-0000-7000-8000-0000000000b1", name: "Jeanne Dupont", email: "jeanne.dupont@example.com", email_verified_at: "2026-11-01T09:00:00+00:00", last_login_at: "2026-11-16T08:30:00+00:00", previous_login_at: null } } },
    [`/api/v1/org/${ORG}`]: { status: 200, body: { data: { id: ORG, kind: "agency", name: "Agence Soleil", country: "FR", currency: "EUR", timezone: "Europe/Paris", two_factor_required: false } } },
    [`/api/v1/org/${ORG}/conversations/unread`]: { status: 200, body: { data: { internal: 0, tenant: 0, owner: 0 } } },
    "/api/v1/notifications/unread-count": { status: 200, body: { data: { unread: 0 } } },
    "/api/v1/notifications": { status: 200, body: { data: [], meta: { next_cursor: null } } },
    [`/api/v1/org/${ORG}/notice-requests`]: { status: 200, body: page([]) },
    [`/api/v1/org/${ORG}/quotes`]: quotes,
    [`/api/v1/org/${ORG}/suppliers`]: { status: 200, body: page([{ id: "01934f6e-0000-7000-8000-0000000000c4", party: { id: SUPPLIER_PARTY, name: "Ramonage du Port SARL", is_anonymized: false }, status: "active", preferred: false, payment_terms_days: null, internal_note: null, trade_term_ids: [], custom_fields: null, lock_version: 1 }]) },
  };
  const fetchMock = vi.fn<typeof fetch>((input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    calls.push(url.pathname);
    const route = routes[url.pathname] ?? { status: 500, body: { type: "about:blank", title: "Route non prévue", status: 500, code: "server_error" } };
    return Promise.resolve(new Response(JSON.stringify(route.body), { status: route.status, headers: { "Content-Type": route.status >= 400 ? "application/problem+json" : "application/json" } }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <Providers>
      <QueryClientProvider client={client}>
        <EspaceShell>
          <DevisRoute />
        </EspaceShell>
      </QueryClientProvider>
    </Providers>,
  );
}

beforeEach(() => {
  state.mode = "api";
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("page devis en mode api", () => {
  it("liste les devis du serveur, sans donnée de démonstration", async () => {
    const calls = stubApi({ status: 200, body: page([quote]) });

    renderPage();

    const table = await screen.findByRole("table", { name: "Devis" });
    expect(within(table).getByText("DEV-2026-0007")).toBeTruthy();
    expect(within(table).getByRole("link", { name: "INT-2026-0042" }).getAttribute("href")).toBe(`/interventions/${INTERVENTION}`);
    await waitFor(() => {
      expect(within(table).getByText("Ramonage du Port SARL")).toBeTruthy();
    });
    expect(calls).toContain(`/api/v1/org/${ORG}/quotes`);
    expect(screen.queryByText("Soumettre au mandant")).toBeNull();
  });

  it("affiche l'erreur du serveur avec un bouton Réessayer", async () => {
    stubApi({ status: 403, body: { type: "about:blank", title: "Interdit", status: 403, code: "forbidden" } });

    renderPage();

    expect(await screen.findByText("Les devis n’ont pas pu être chargés")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
  });
});
