import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../../test/axe";
import EncaissementsRoute from "@/app/(espace)/finances/encaissements/page";
import NouveauRoute from "@/app/(espace)/finances/encaissements/nouveau/page";
import { LoyerDetailScreen } from "@/features/gestion/screens";
import { Providers } from "@/app/providers";

const ORG = "01934f6e-0000-7000-8000-00000000000b";
const LEASE = "01a1e544-3c7b-7316-ad15-a82486eff490";
const PARTY = "01a1e544-3c81-7271-9be9-e27ad46d4aa7";
const INSTALLMENT = "01a1e544-3cc7-70db-88c0-a4c892957933";
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
  usePathname: () => "/finances/encaissements",
}));

const eur = (amount: number) => ({ amount, currency: "EUR" });
const links = { first: null, last: null, prev: null, next: null };
const page = <T,>(data: T[]) => ({ data, links, meta: { path: "https://api.test/x", per_page: 25, next_cursor: null, prev_cursor: null } });
const payment = {
  id: "01a1e544-3e8f-72a7-a9e1-e37b5c56d00e",
  lease_id: LEASE,
  party_id: PARTY,
  status: "recorded",
  method: "transfer",
  amount: eur(40000),
  received_on: "2026-11-16",
  reference: "VIR-4521",
  note: null,
  cancelled_on: null,
  cancellation_reason: null,
  recorded_at: "2026-11-16T10:00:00+00:00",
  allocations: [{ installment_id: INSTALLMENT, amount: eur(40000) }],
  advance: eur(0),
  replayed: null,
  receipts: null,
};
const installment = {
  id: INSTALLMENT,
  lease: { id: LEASE, reference: "BL-2026-42865" },
  party_id: PARTY,
  unit_id: "01a1e544-3c7f-73f3-b4e7-64b4f79c77a6",
  period: { start: "2026-11-01", end: "2026-11-30" },
  due_date: "2026-11-05",
  status: "issued",
  is_overdue: true,
  amounts: { rent: eur(65000), charges: eur(5000), vat: eur(0), total: eur(70000) },
  outstanding: eur(70000),
  issued_on: "2026-11-16",
  cancelled_on: null,
  cancellation_reason: null,
  notice: null,
  receipt: null,
  receipt_state: "not_due",
  lines: [],
};

function stubApi(role = "accountant", extra: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const routes: Record<string, unknown> = {
    "/api/v1/me/profiles": { data: [{ space: "organization", label: "Agence Soleil", meta: { organization: ORG, kind: "agency", role } }] },
    [org()]: { data: { id: ORG, kind: "agency", name: "Agence Soleil", country: "FR", currency: "EUR", timezone: "Europe/Paris", two_factor_required: false } },
    [org("/rent/payments")]: page([payment]),
    [org(`/rent/installments/${INSTALLMENT}`)]: { data: installment },
    [org(`/rent/leases/${LEASE}/balance`)]: { data: { lease_id: LEASE, balance: eur(70000), overdue: eur(70000), advance: eur(0), unpaid_count: 1, oldest_unpaid_due_date: "2026-11-05" } },
    [org("/leases")]: page([]),
    [org("/parties")]: page([]),
    ...extra,
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

function renderWith(children: ReactNode) {
  return render(
    <Providers>
      <TooltipProvider>
        <ToastProvider>{children}</ToastProvider>
      </TooltipProvider>
    </Providers>,
  );
}

const DEMO_TEXTS = ["Sophie Delmas", "Cabinet Delmas", "Marc Chevalier", "Anaïs Roux", "Apt 12"];

beforeEach(() => {
  state.mode = "api";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("encaissements de l'agence en mode api", () => {
  it("sert les paiements de loyer depuis l'API, sans donnée de démonstration", async () => {
    const calls = stubApi("manager");

    const view = renderWith(<EncaissementsRoute />);

    const table = await screen.findByRole("table", { name: "Paiements de loyer" });
    expect(within(table).getByText("VIR-4521")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Enregistrer un paiement" }).getAttribute("href")).toBe("/finances/loyers/paiements/nouveau");
    expect(calls).toContain(org("/rent/payments"));
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(view.container);
  });

  it("masque l'annulation au comptable, qui peut enregistrer un paiement", async () => {
    stubApi("accountant");

    renderWith(<EncaissementsRoute />);

    await screen.findByRole("table", { name: "Paiements de loyer" });
    expect(screen.getByRole("link", { name: "Enregistrer un paiement" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Actions pour le paiement/ })).toBeNull();
  });

  it("traduit un refus du serveur sans afficher de paiement", async () => {
    stubApi("manager", { [org("/rent/payments")]: undefined });

    renderWith(<EncaissementsRoute />);

    expect(await screen.findByText(/n’ont pas pu être chargés|Route non prévue|erreur/i)).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Paiements de loyer" })).toBeNull();
  });

  it("sert la saisie d'un paiement depuis l'API", async () => {
    const calls = stubApi("manager");

    const view = renderWith(<NouveauRoute />);

    expect(await screen.findByRole("heading", { level: 1, name: "Enregistrer un paiement" })).toBeTruthy();
    expect(calls.some((call) => call.startsWith(org("/leases")))).toBe(true);
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(view.container);
  });

  it("sert le détail d'un impayé depuis l'échéance de l'API", async () => {
    const calls = stubApi("manager");

    renderWith(<LoyerDetailScreen id={INSTALLMENT} />);

    expect(await screen.findByText(/Échéance de/)).toBeTruthy();
    expect(calls).toContain(org(`/rent/installments/${INSTALLMENT}`));
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });
});

describe("encaissements de l'agence en mode démo", () => {
  it("garde la page de démonstration, sans appel réseau", async () => {
    state.mode = "demo";
    const calls = stubApi();

    renderWith(<EncaissementsRoute />);

    expect(await screen.findAllByRole("heading", { level: 1 })).not.toHaveLength(0);
    expect(calls).toEqual([]);
  });
});
