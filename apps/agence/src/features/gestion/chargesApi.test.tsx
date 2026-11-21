import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExercicesRoute from "@/app/(espace)/finances/charges/page";
import ClesRoute from "@/app/(espace)/finances/charges/cles/page";
import ExerciceRoute from "@/app/(espace)/finances/charges/[id]/page";
import NouvelExerciceRoute from "@/app/(espace)/finances/charges/nouveau/page";
import DepensesRoute from "@/app/(espace)/finances/depenses/page";
import DepenseRoute from "@/app/(espace)/finances/depenses/[id]/page";
import NouvelleDepenseRoute from "@/app/(espace)/finances/depenses/nouvelle/page";
import { Providers } from "@/app/providers";

const ORG = "01934f6e-0000-7000-8000-00000000000b";
const PROPERTY = "01934f6e-0000-7000-8000-0000000000a1";
const EXPENSE = "01934f6e-0000-7000-8000-0000000000d1";
const EXERCISE = "01934f6e-0000-7000-8000-000000000101";
const CATEGORY = "01934f6e-0000-7000-8000-0000000000c1";
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
  usePathname: () => "/finances/depenses",
  notFound: () => {
    throw new Error("notFound");
  },
}));

const eur = (amount: number) => ({ amount, currency: "EUR" });
const links = { first: null, last: null, prev: null, next: null };
const page = <T,>(data: T[]) => ({ data, links, meta: { path: "https://api.test/x", per_page: 25, next_cursor: null, prev_cursor: null } });
const expense = {
  id: EXPENSE,
  property_id: PROPERTY,
  unit_id: null,
  kind: "payment",
  category_term_id: CATEGORY,
  payee_party_id: null,
  payee_label: "Société Propreté Plus",
  reference: "FAC-2026-014",
  document_on: "2026-03-12",
  service_from: "2026-01-01",
  service_to: "2026-04-01",
  total_gross: eur(120000),
  tax_amount: eur(20000),
  recoverable_amount: eur(100000),
  recoverable_rubric: "cleaning",
  settlement: "bank",
  paid_on: "2026-03-15",
  mandate_id: null,
  mandant_party_id: null,
  status: "recorded",
  cancel_reason: null,
  posted: true,
  files: [],
  lock_version: 1,
  created_at: "2026-03-12T09:00:00+00:00",
};
const exercise = {
  id: EXERCISE,
  property_id: PROPERTY,
  period_start: "2025-01-01",
  period_end: "2026-01-01",
  status: "draft",
  jurisdiction: "FR",
  only_lease_id: null,
  prescription_acknowledged: false,
  computed_at: null,
  issued_at: null,
  lock_version: 3,
};
const properties = page([{ id: PROPERTY, name: "Résidence des Lilas", type: "building", address: {}, active_units_count: 2, archived_at: null }]);
const term = (vocabulary: string, key: string, label: string, id: string) => ({ id, vocabulary, key, labels: { fr: label }, semantic_key: null, parent_id: null, position: 1, metadata: { recoverable_by_default: true }, platform: true, system: true, archived: false, hidden: false, overridden: false });

function stubApi(role = "accountant") {
  const calls: string[] = [];
  const routes: Record<string, unknown> = {
    "/api/v1/me/profiles": { data: [{ space: "organization", label: "Agence Soleil", meta: { organization: ORG, kind: "agency", role } }] },
    [org("/charges/expenses")]: page([expense]),
    [org(`/charges/expenses/${EXPENSE}`)]: { data: expense },
    [org("/charges/exercises")]: page([exercise]),
    [org(`/charges/exercises/${EXERCISE}`)]: { data: { ...exercise, items: [], statements: [] } },
    [org(`/charges/properties/${PROPERTY}/charge-keys`)]: { data: [] },
    [org("/properties")]: properties,
    [org("/units")]: page([]),
    [org("/catalog/vocabularies/expense_category/terms")]: { data: [term("expense_category", "maintenance", "Entretien", CATEGORY)] },
    [org("/catalog/vocabularies/charge_rubric/terms")]: { data: [term("charge_rubric", "cleaning", "Entretien des parties communes", "01934f6e-0000-7000-8000-0000000001a1")] },
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
const params = (id: string) => ({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });

beforeEach(() => {
  state.mode = "api";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("charges de l'agence en mode api", () => {
  it("sert les dépenses depuis l'API, sans donnée de démonstration", async () => {
    const calls = stubApi();

    renderWith(<DepensesRoute />);

    const table = await screen.findByRole("table", { name: "Dépenses" });
    expect((await within(table).findAllByText("Société Propreté Plus")).length).toBeGreaterThan(0);
    expect(table.textContent).toMatch(/1\s200/);
    expect(calls).toContain(org("/charges/expenses"));
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });

  it("sert la fiche d'une dépense par son identifiant", async () => {
    const calls = stubApi();

    renderWith(<DepenseRoute {...params(EXPENSE)} />);

    expect(await screen.findByRole("heading", { name: "Société Propreté Plus" })).toBeTruthy();
    expect(calls).toContain(org(`/charges/expenses/${EXPENSE}`));
  });

  it("sert le formulaire de saisie avec la devise de l'organisation", async () => {
    stubApi();

    renderWith(<NouvelleDepenseRoute />);

    expect(await screen.findByLabelText(/Montant TTC \(EUR\)/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enregistrer la dépense" })).toBeTruthy();
  });

  it("sert les exercices et le détail d'un exercice", async () => {
    const calls = stubApi();

    renderWith(<ExercicesRoute />);
    expect(await screen.findByRole("table", { name: "Exercices de charges" })).toBeTruthy();
    expect(calls).toContain(org("/charges/exercises"));
  });

  it("sert le détail d'un exercice avec son éditeur de postes", async () => {
    stubApi();

    renderWith(<ExerciceRoute {...params(EXERCISE)} />);

    expect(await screen.findByRole("heading", { name: /Exercice du 01\/01\/2025/ })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Ajouter un poste" })).toBeTruthy();
  });

  it("sert le formulaire d'exercice et les clés de répartition", async () => {
    stubApi();

    renderWith(<NouvelExerciceRoute />);
    expect(await screen.findByRole("button", { name: "Créer l’exercice" })).toBeTruthy();
  });

  it("explique qu'aucun bien n'est retenu sur la page des clés", async () => {
    stubApi();

    renderWith(<ClesRoute />);

    expect(await screen.findByText(/Choisissez un bien pour voir ses clés/)).toBeTruthy();
  });

  it("n'ouvre aucune organisation pour un rôle inconnu, sans appeler les charges", async () => {
    const calls = stubApi("viewer");

    renderWith(<DepensesRoute />);

    expect(await screen.findByText("Aucune organisation")).toBeTruthy();
    expect(calls.filter((path) => path.includes("/charges/"))).toEqual([]);
  });

  it("masque l'export CSV au gestionnaire", async () => {
    stubApi("manager");

    renderWith(<DepensesRoute />);

    await screen.findByRole("table", { name: "Dépenses" });
    expect(screen.queryByRole("button", { name: "Exporter en CSV" })).toBeNull();
  });
});

describe("charges de l'agence en mode démo", () => {
  it.each([
    ["dépenses", () => <DepensesRoute />],
    ["saisie d'une dépense", () => <NouvelleDepenseRoute />],
    ["exercices", () => <ExercicesRoute />],
    ["nouvel exercice", () => <NouvelExerciceRoute />],
    ["clés de répartition", () => <ClesRoute />],
  ] as const)("ne sert pas %s hors mode api, sans appel réseau", (_name, element) => {
    state.mode = "demo";
    const calls = stubApi();

    expect(() => renderWith(element())).toThrow("notFound");
    expect(calls).toEqual([]);
  });
});
