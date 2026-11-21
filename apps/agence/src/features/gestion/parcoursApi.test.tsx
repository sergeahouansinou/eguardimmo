import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AvisEcheancePage from "@/app/(espace)/baux/avis-echeance/page";
import InvitationPage from "@/app/(espace)/locataires/invitation/page";
import ReglagesPage from "@/app/(espace)/reglages/page";
import { Providers } from "@/app/providers";

const ORG = "01934f6e-0000-7000-8000-00000000000b";
const PARTY = "01a1e544-3c81-7271-9be9-e27ad46d4aa7";
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
  useSearchParams: () => new URLSearchParams("mois=2026-11"),
  usePathname: () => "/",
}));

const money = (amount: number) => ({ amount, currency: "EUR" });
const installment = {
  id: "01a1e544-3cc7-70db-88c0-a4c892957933",
  lease: { id: "01a1e544-3c7b-7316-ad15-a82486eff490", reference: "BL-2026-42865" },
  party_id: PARTY,
  unit_id: "01a1e544-3c7f-73f3-b4e7-64b4f79c77a6",
  period: { start: "2026-11-01", end: "2026-11-30" },
  due_date: "2026-11-05",
  status: "upcoming",
  is_overdue: false,
  amounts: { rent: money(65000), charges: money(5000), vat: money(0), total: money(70000) },
  outstanding: null,
  issued_on: null,
  cancelled_on: null,
  cancellation_reason: null,
  notice: null,
  receipt: null,
  receipt_state: "not_due",
};
const identity = {
  legal_name: "Agence Soleil SARL",
  address: { line1: "24 avenue de la République", line2: null, postal_code: "75011", city: "Paris", country: "FR" },
  siren: "123456782",
  siret: null,
  vat_number: null,
  legal_form: "SARL",
  share_capital: money(2000000),
  registry_city: null,
  professional_card_number: null,
  professional_card_issuer: null,
  guarantee_provider: null,
  guarantee_amount: null,
  vat_regime: "normal",
  vat_on_debits: false,
  payment_terms_days: 30,
};
const party = { id: PARTY, kind: "person", display_name: "Danielle Martin", primary_email: "danielle.martin@example.com", primary_phone: null, is_anonymized: false, archived_at: null };
const page = <T,>(data: T[]) => ({ data, links: { first: null, last: null, prev: null, next: null }, meta: { per_page: 25, next_cursor: null, prev_cursor: null } });

function stubApi(role = "owner", extra: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const routes: Record<string, unknown> = {
    "/api/v1/me/profiles": { data: [{ space: "organization", label: "Agence Soleil", meta: { organization: ORG, kind: "agency", role } }] },
    [org()]: { data: { id: ORG, kind: "agency", name: "Agence Soleil", country: "FR", currency: "EUR", timezone: "Europe/Paris", two_factor_required: false } },
    [org("/parties")]: page([party]),
    [org(`/parties/${PARTY}/tenant-access`)]: { data: { party_id: PARTY, status: "none", email_hint: null, expires_at: null, linked_at: null } },
    [org("/rent/installments")]: page([installment]),
    [org("/legal-identity")]: { data: identity },
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

describe("Invitation d'un locataire en mode api", () => {
  it("lit les contacts et l'état d'accès sur l'API, sans donnée de démonstration", async () => {
    const calls = stubApi();

    renderWith(<InvitationPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Gérer l’accès de Danielle Martin" }));

    expect(await screen.findByText("Aucune invitation")).toBeTruthy();
    expect(calls).toContain(org("/parties"));
    expect(calls).toContain(org(`/parties/${PARTY}/tenant-access`));
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });

  it("masque la gestion au comptable", async () => {
    stubApi("accountant");

    renderWith(<InvitationPage />);

    expect(await screen.findByText("Invitations réservées à la gestion")).toBeTruthy();
  });
});

describe("Avis d'échéance en mode api", () => {
  it("liste les échéances du mois sur l'API", async () => {
    const calls = stubApi();

    renderWith(<AvisEcheancePage />);

    const table = await screen.findByRole("table", { name: "Avis d’échéance" });
    expect(within(table).getByText("BL-2026-42865")).toBeTruthy();
    expect(within(table).getByText("À émettre")).toBeTruthy();
    expect(calls).toContain(org("/rent/installments"));
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });
});

describe("Réglages en mode api", () => {
  it("affiche l'identité légale du serveur, modifiable par le titulaire", async () => {
    const calls = stubApi();

    renderWith(<ReglagesPage />);

    await waitFor(() => { expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Raison sociale *" }).value).toBe("Agence Soleil SARL"); });
    expect(calls).toContain(org("/legal-identity"));
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: /Téléphone/ })).toBeNull();
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });

  it("passe en lecture seule pour un gestionnaire", async () => {
    stubApi("manager");

    renderWith(<ReglagesPage />);

    expect(await screen.findByText("Lecture seule")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).toBeNull();
  });
});

describe("Écrans en mode démo", () => {
  it("gardent les pages de démonstration, sans appel réseau", async () => {
    state.mode = "demo";
    const calls = stubApi();

    renderWith(<InvitationPage />);
    renderWith(<AvisEcheancePage />);
    renderWith(<ReglagesPage />);

    expect(await screen.findAllByRole("heading", { level: 1 })).not.toHaveLength(0);
    expect(calls).toEqual([]);
  });
});
