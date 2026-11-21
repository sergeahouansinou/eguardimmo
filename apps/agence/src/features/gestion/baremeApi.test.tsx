import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BaremeRoute from "@/app/(espace)/finances/honoraires/bareme/page";
import { Providers } from "@/app/providers";

const ORG = "01934f6e-0000-7000-8000-00000000000b";
const MANDATE = "01a1ee5a-0bb7-73fa-a273-ea6cbd9ab041";
const PARTY = "01a1ee5a-0bb7-73fa-a273-ea6cbd9ab002";
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
  usePathname: () => "/finances/honoraires/bareme",
}));

const eur = (amount: number) => ({ amount, currency: "EUR" });
const amounts = (source: string, net: number, tax: number, minimumApplied = false) => ({ source, fee_net: eur(net), tax_amount: eur(tax), fee_total: eur(net + tax), minimum_applied: minimumApplied });

const mandate = {
  id: MANDATE,
  reference: "M-2026-0001",
  status: "active",
  mandant: { id: PARTY, display_name: "Awa Diallo", kind: "person", is_anonymized: false },
  mandate_type: { id: "01a1ee5a-0bb7-73fa-a273-ea6cbd9ab0b1", key: "gestion", label: "Mandat de gestion", semantic_key: "management" },
  starts_on: "2026-01-01",
  end_date: "2028-12-31",
  tacit_renewal: false,
  currency: "EUR",
  units: [],
  terms: {
    id: "01a1ee5a-0bb7-73fa-a273-ea6cbd9ab0b4",
    fee_kind: "percentage",
    fee_basis_points: 800,
    fee_flat_amount: null,
    payout_day: 10,
    works_limit_amount: eur(50000),
    fee_base: "rent",
    fee_minimum_amount: eur(0),
    fee_tax_mode: "excl_tax",
    letting_fee_basis_points: null,
    works_fee_basis_points: null,
    signed_file_id: null,
    valid_from: "2026-01-01",
    valid_to: null,
    reason: "initial",
  },
  lock_version: 3,
  archived_at: null,
};

const simulation = {
  data: [{ month: "2026-10", base_rent: eur(120000), base_charges: eur(15000), current: amounts("statement", 9600, 1920), simulated: amounts("simulation", 9000, 1800), difference: { fee_net: eur(-600), fee_total: eur(-720) } }],
  meta: {
    mandate_id: MANDATE,
    months_requested: 3,
    months_returned: 1,
    currency: "EUR",
    reason: null,
    totals: { simulated_fee_net: eur(9000), simulated_fee_total: eur(10800), current_fee_net: eur(9600), current_fee_total: eur(11520), difference_fee_net: eur(-600), difference_fee_total: eur(-720) },
  },
};

function stubApi(role = "manager") {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const routes: Record<string, unknown> = {
    "/api/v1/me/profiles": { data: [{ space: "organization", label: "Agence Soleil", meta: { organization: ORG, kind: "agency", role } }] },
    [org("/mandates")]: { data: [mandate], meta: { per_page: 100, next_cursor: null } },
    [org("/owner-funds/fees/simulations")]: simulation,
  };
  const fetchMock = vi.fn<typeof fetch>((input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    calls.push({ method: init?.method ?? "GET", path: url.pathname, body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : null });
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

beforeEach(() => {
  state.mode = "api";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("barème des honoraires de l'agence en mode api", () => {
  it("simule le barème d'un mandat réel, sans donnée de démonstration", async () => {
    const calls = stubApi();

    renderWith(<BaremeRoute />);

    await userEvent.click(await screen.findByRole("combobox", { name: /Mandat/ }));
    await userEvent.click(await screen.findByRole("option", { name: /M-2026-0001/ }));
    await userEvent.click(screen.getByRole("button", { name: "Simuler le barème" }));

    const table = await screen.findByRole("table", { name: "Simulation des honoraires mois par mois" });
    expect(within(table).getByText(/Octobre 2026/)).toBeTruthy();
    const post = calls.find((call) => call.method === "POST");
    expect(post?.path).toBe(org("/owner-funds/fees/simulations"));
    expect(post?.body).toEqual({ mandate_id: MANDATE, fee_kind: "percentage", fee_basis_points: 800, fee_base: "rent", fee_minimum_amount: 0, fee_tax_mode: "excl_tax", months: 3 });
    for (const text of ["Sophie Delmas", "Cabinet Delmas", "Marc Chevalier", "M-2025-0142"]) expect(document.body.textContent).not.toContain(text);
    expect(screen.queryByText(/appliquer à tous/i)).toBeNull();
  });
});

describe("barème des honoraires de l'agence en mode démo", () => {
  it("garde le formulaire de démonstration, sans appel réseau", async () => {
    state.mode = "demo";
    const calls = stubApi();

    renderWith(<BaremeRoute />);

    expect(await screen.findByRole("heading", { level: 1, name: "Barème des honoraires" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enregistrer le barème" })).toBeTruthy();
    expect(calls).toEqual([]);
  });
});
