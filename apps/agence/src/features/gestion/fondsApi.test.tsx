import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClotureRoute from "@/app/(espace)/finances/cloture/page";
import FondsRoute from "@/app/(espace)/finances/fonds/page";
import HonorairesRoute from "@/app/(espace)/finances/honoraires/page";
import DemandesIbanRoute from "@/app/(espace)/finances/reversements/demandes-iban/page";
import ReversementsRoute from "@/app/(espace)/finances/reversements/page";
import { Providers } from "@/app/providers";

const ORG = "01934f6e-0000-7000-8000-00000000000b";
const MANDANT = "01a1ee5a-0bb7-73fa-a273-ea6cbd9ab002";
const org = (path: string) => `/api/v1/org/${ORG}${path}`;

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
  usePathname: () => "/finances/reversements",
}));

const eur = (amount: number) => ({ amount, currency: "EUR" });
const links = { first: null, last: null, prev: null, next: null };
const page = <T,>(data: T[]) => ({ data, links, meta: { path: "https://api.test/x", per_page: 25, next_cursor: null, prev_cursor: null } });
const evaluation = {
  mandant_party_id: MANDANT,
  payable: eur(120000),
  in_transit: eur(0),
  called_not_collected: eur(0),
  fees_due: eur(9600),
  fees_estimated: eur(0),
  reserve: eur(0),
  full_hold: false,
  net_payable: eur(110400),
  bank_last4: "4321",
  exclusion_reason: null,
};
const coverage = { trust_bank: eur(900000), owner_payable: eur(500000), payouts_in_transit: eur(100000), security_deposits: eur(150000), tenant_advances: eur(10000), required: eur(760000), surplus: eur(140000), covered: true };
const period = { id: "01a1ee5a-0bb7-73fa-a273-ea6cbd9ab060", month: "2026-10", period_start: "2026-10-01", period_end_exclusive: "2026-11-01", closed_at: "2026-11-02T08:00:00+00:00", closed_by_user_id: MANDANT, closing_cutoff: { version: "v1" } };
const fee = {
  id: "01a1ee5a-0bb7-73fa-a273-ea6cbd9ab040",
  mandate_id: "01a1ee5a-0bb7-73fa-a273-ea6cbd9ab041",
  mandant_party_id: MANDANT,
  month: "2026-10",
  base_rent: eur(120000),
  base_charges: eur(0),
  fee_kind: "percentage",
  rate_bp: 800,
  minimum_applied: false,
  fee_net: eur(9600),
  tax_amount: eur(0),
  fee_total: eur(9600),
  carried_net: eur(0),
  invoice_id: null,
  credit_note_id: null,
};

const ibanRequest = {
  id: "01a1ee5a-0bb7-73fa-a273-ea6cbd9ab0a1",
  mandant_party_id: MANDANT,
  status: "pending",
  bank_account_id: "01a1ee5a-0bb7-73fa-a273-ea6cbd9ab0c1",
  bank_last4: "7890",
  holder_name: "Awa Diallo",
  proof_file_id: "01a1ee5a-0bb7-73fa-a273-ea6cbd9ab0b1",
  requested_by_user_id: MANDANT,
  decided_by_user_id: null,
  decided_at: null,
  reject_reason: null,
  lock_version: 4,
  created_at: "2026-11-16T08:30:00+00:00",
};

function stubApi(role = "accountant") {
  const calls: string[] = [];
  const routes: Record<string, unknown> = {
    "/api/v1/me/profiles": { data: [{ space: "organization", label: "Agence Soleil", meta: { organization: ORG, kind: "agency", role } }] },
    [org("/owner-funds/payouts/preview")]: { data: [evaluation], meta: { limit: 20, truncated: false } },
    [org("/owner-funds/batches")]: page([]),
    [org("/owner-funds/holds")]: page([]),
    [org("/owner-funds/fees")]: page([fee]),
    [org("/owner-funds/payout-account-requests")]: page([ibanRequest]),
    [org("/owner-funds/trust/coverage")]: { data: coverage },
    [org("/owner-funds/trust/deposits")]: page([]),
    [org("/accounting/periods")]: { data: [period] },
    [org(`/parties/${MANDANT}`)]: { data: { id: MANDANT, kind: "person", display_name: "Awa Diallo", last_name: null, first_name: null, company_name: null, is_anonymized: false, archived_at: null } },
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

describe("fonds des mandants de l'agence en mode api", () => {
  it("sert les reversements depuis l'API, sans donnée de démonstration", async () => {
    const calls = stubApi();

    renderWith(<ReversementsRoute />);

    const table = await screen.findByRole("table", { name: "Net à reverser par mandant" });
    expect((await within(table).findAllByText(/Awa Diallo/)).length).toBeGreaterThan(0);
    expect(table.textContent).toContain("IBAN •••• 4321");
    expect(calls).toContain(org("/owner-funds/payouts/preview"));
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });

  it("sert les honoraires depuis l'API", async () => {
    const calls = stubApi();

    renderWith(<HonorairesRoute />);

    expect(await screen.findByRole("table", { name: "Honoraires de gestion" })).toBeTruthy();
    expect(calls).toContain(org("/owner-funds/fees"));
  });

  it("sert le fonds de tiers et la couverture du cantonnement", async () => {
    const calls = stubApi();

    renderWith(<FondsRoute />);

    expect(await screen.findByText("Couvert")).toBeTruthy();
    expect(calls).toContain(org("/owner-funds/trust/coverage"));
    expect(screen.getByRole("button", { name: "Enregistrer un apport" })).toBeTruthy();
  });

  it("masque l'apport et le prélèvement au gestionnaire", async () => {
    stubApi("manager");

    renderWith(<FondsRoute />);

    await screen.findByText("Couvert");
    expect(screen.queryByRole("button", { name: "Enregistrer un apport" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Prélever les honoraires" })).toBeNull();
  });

  it("sert les demandes de changement d'IBAN des propriétaires", async () => {
    const calls = stubApi();

    renderWith(<DemandesIbanRoute />);

    const table = await screen.findByRole("table", { name: "Demandes de changement d’IBAN" });
    expect(table.textContent).toContain("7890");
    expect(screen.getByRole("button", { name: /Approuver/ })).toBeTruthy();
    expect(calls).toContain(org("/owner-funds/payout-account-requests"));
    expect(document.body.textContent).not.toMatch(/FR76|[A-Z]{2}\d{2}\s?\d{4}/);
  });

  it("masque l'approbation et le refus au gestionnaire", async () => {
    stubApi("manager");

    renderWith(<DemandesIbanRoute />);

    await screen.findByRole("table", { name: "Demandes de changement d’IBAN" });
    expect(screen.queryByRole("button", { name: /Approuver/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Refuser/ })).toBeNull();
  });

  it("sert la clôture mensuelle", async () => {
    const calls = stubApi();

    renderWith(<ClotureRoute />);

    expect(await screen.findByRole("table", { name: "Mois clos" })).toBeTruthy();
    expect(calls).toContain(org("/accounting/periods"));
  });
});

describe("fonds des mandants de l'agence en mode démo", () => {
  it("garde les reversements de démonstration, sans appel réseau", async () => {
    state.mode = "demo";
    const calls = stubApi();

    renderWith(<ReversementsRoute />);

    expect(await screen.findAllByRole("heading", { level: 1 })).not.toHaveLength(0);
    expect(calls).toEqual([]);
  });

  it("ne sert pas les demandes d'IBAN hors mode api", () => {
    state.mode = "demo";
    expect(() => renderWith(<DemandesIbanRoute />)).toThrow();
  });

  it("ne sert pas le fonds de tiers hors mode api", () => {
    state.mode = "demo";
    expect(() => renderWith(<FondsRoute />)).toThrow();
  });
});
