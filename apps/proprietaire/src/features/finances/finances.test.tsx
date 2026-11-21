import { ToastProvider, TooltipProvider } from "@eguardimmo/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BailleurData } from "@/app/(espace)/BailleurData";
import BanquePage from "@/app/(espace)/finances/banque/page";
import ComptesPage from "@/app/(espace)/finances/banque/comptes/page";
import ReleveDetailPage from "@/app/(espace)/finances/banque/releves/[id]/page";
import RelevesPage from "@/app/(espace)/finances/banque/releves/page";
import EtatsPage from "@/app/(espace)/finances/banque/etats/page";
import ExerciceDetailPage from "@/app/(espace)/finances/charges/[id]/page";
import ExerciceNouveauPage from "@/app/(espace)/finances/charges/nouveau/page";
import ImportBanquePage from "@/app/(espace)/finances/banque/import/page";
import ChargesPage from "@/app/(espace)/finances/charges/page";
import ClesPage from "@/app/(espace)/finances/charges/cles/page";
import DepenseDetailPage from "@/app/(espace)/finances/depenses/[id]/page";
import DepenseNouvellePage from "@/app/(espace)/finances/depenses/nouvelle/page";
import DepensesPage from "@/app/(espace)/finances/depenses/page";
import ImportBancairePage from "@/app/(espace)/finances/import-bancaire/page";
import RegularisationPage from "@/app/(espace)/finances/regularisation/page";
import { Resolved } from "./gates";
import { EXERCISE, EXPENSE, PROPERTY, STATEMENT, org, stubApi } from "./testing";

const env = vi.hoisted((): { mode: "demo" | "api" } => ({ mode: "api" }));

vi.mock("@/lib/env", () => ({
  get dataSource() {
    return env.mode;
  },
  apiEnv: () => ({ NEXT_PUBLIC_API_URL: "https://api.test", NEXT_PUBLIC_AUTH_URL: "http://localhost:3040", NEXT_PUBLIC_DATA_SOURCE: env.mode }),
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
    throw new Error("NEXT_NOT_FOUND");
  },
}));

function renderInSpace(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <BailleurData>{ui}</BailleurData>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  env.mode = "api";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const DEMO_TEXTS = ["Marc Chevalier", "Gestion Les Tilleuls", "SCI Les Tilleuls", "Sophie Delmas"];
const params = (id: string) => ({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });
const noFinanceCall = (paths: string[]) => paths.filter((path) => /\/(charges|banking)\//.test(path));

describe("finances de l'espace bailleur en mode api", () => {
  it("liste les dépenses lues sur l'API de l'organisation individuelle", async () => {
    const api = stubApi();

    renderInSpace(<DepensesPage />);

    const table = await screen.findByRole("table", { name: "Dépenses" });
    expect((await within(table).findAllByText("Plomberie du Lac")).length).toBeGreaterThan(0);
    expect(table.textContent).toMatch(/1\s200/);
    expect(api.paths()).toContain(org("/charges/expenses"));
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });

  it("affiche la fiche d'une dépense par son identifiant", async () => {
    const api = stubApi();

    renderInSpace(<DepenseDetailPage {...params(EXPENSE)} />);

    expect(await screen.findByRole("heading", { name: "Plomberie du Lac" })).toBeTruthy();
    expect(api.paths()).toContain(org(`/charges/expenses/${EXPENSE}`));
  });

  it("propose à un bailleur autonome les seuls règlements banque, espèces et sans règlement", async () => {
    stubApi();
    const user = userEvent.setup();

    renderInSpace(<DepenseNouvellePage />);

    expect(await screen.findByLabelText(/Montant TTC \(EUR\)/)).toBeTruthy();
    await user.click(await screen.findByRole("combobox", { name: /Mode de règlement/ }));
    const options = (await screen.findAllByRole("option")).map((option) => option.textContent);
    expect(options.some((text) => text.startsWith("Banque"))).toBe(true);
    expect(options.some((text) => text.startsWith("Espèces"))).toBe(true);
    expect(options.some((text) => text.startsWith("Sans règlement"))).toBe(true);
    expect(options.some((text) => /mandant|agence/i.test(text))).toBe(false);
  });

  it("liste les exercices, ouvre un exercice et le formulaire de création", async () => {
    const api = stubApi();

    const first = renderInSpace(<RegularisationPage />);
    expect(await screen.findByRole("table", { name: "Exercices de charges" })).toBeTruthy();
    expect(api.paths()).toContain(org("/charges/exercises"));
    first.unmount();

    const second = renderInSpace(<ExerciceDetailPage {...params(EXERCISE)} />);
    expect(await screen.findByRole("button", { name: "Ajouter un poste" })).toBeTruthy();
    second.unmount();

    renderInSpace(<ExerciceNouveauPage />);
    expect(await screen.findByRole("button", { name: "Créer l’exercice" })).toBeTruthy();
  });

  it("sert la page de régularisation et les clés de répartition", async () => {
    stubApi();

    const first = renderInSpace(<ChargesPage />);
    expect(await screen.findByRole("table", { name: "Exercices de charges" })).toBeTruthy();
    first.unmount();

    renderInSpace(<ClesPage />);
    expect(await screen.findByText(/Choisissez un bien pour voir ses clés/)).toBeTruthy();
  });

  it("sert les comptes, relevés, états de rapprochement et le pointage", async () => {
    const api = stubApi();

    const pointage = renderInSpace(<BanquePage />);
    expect((await screen.findAllByText("VIR LOYER MARS MARTIN")).length).toBeGreaterThan(0);
    expect(api.paths()).toContain(org("/banking/lines"));
    pointage.unmount();

    const comptes = renderInSpace(<ComptesPage />);
    expect((await screen.findAllByText("Compte courant Dupont")).length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain("0189");
    comptes.unmount();

    const releves = renderInSpace(<RelevesPage />);
    expect((await screen.findAllByText("Compte courant Dupont")).length).toBeGreaterThan(0);
    expect(api.paths()).toContain(org("/banking/statements"));
    releves.unmount();

    renderInSpace(<EtatsPage />);
    expect(await screen.findByRole("button", { name: /Calculer/ })).toBeTruthy();
    expect(api.paths()).toContain(org("/banking/reconciliations"));
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });

  it.each([
    ["l'import bancaire", () => <ImportBancairePage />],
    ["l'import d'un relevé", () => <ImportBanquePage />],
  ])("sert %s avec le choix du compte lu sur l'API", async (_name, element) => {
    const api = stubApi();

    renderInSpace(element());

    expect(await screen.findByText(/Compte courant Dupont/)).toBeTruthy();
    expect(api.paths()).toContain(org("/banking/accounts"));
  });

  it("n'ouvre aucune organisation pour un rôle inconnu, sans appeler charges ni banque", async () => {
    const api = stubApi("viewer");

    renderInSpace(<DepensesPage />);

    expect(await screen.findByText("Aucune organisation")).toBeTruthy();
    expect(noFinanceCall(api.paths())).toEqual([]);
  });

  it("n'ouvre pas la banque à une organisation qui n'est pas individuelle", async () => {
    const api = stubApi("owner", "agency");

    renderInSpace(<BanquePage />);

    expect(await screen.findByText("Aucune organisation")).toBeTruthy();
    expect(noFinanceCall(api.paths())).toEqual([]);
  });

  it("affiche le relevé importé et son détail", async () => {
    const api = stubApi();

    renderInSpace(<ReleveDetailPage {...params(STATEMENT)} />);

    expect((await screen.findAllByText(/Compte courant Dupont/)).length).toBeGreaterThan(0);
    expect(api.paths()).toContain(org(`/banking/statements/${STATEMENT}`));
  });

  it("enregistre une dépense saisie par un bailleur autonome avec une clé d'idempotence", async () => {
    const api = stubApi("owner", "individual", { [`POST ${org("/charges/expenses")}`]: { data: {} } });
    const user = userEvent.setup();
    const choose = async (label: RegExp, option: RegExp) => {
      await user.click(await screen.findByRole("combobox", { name: label }));
      await user.click(await screen.findByRole("option", { name: option }));
    };

    renderInSpace(<DepenseNouvellePage />);
    await screen.findByLabelText(/Montant TTC \(EUR\)/);
    await choose(/Bien/, /Résidence des Lilas/);
    await choose(/Catégorie/, /Entretien/);
    await user.type(screen.getByLabelText(/Fournisseur/), "Plomberie du Lac");
    fireEvent.change(screen.getByLabelText(/Date de la pièce/), { target: { value: "2026-03-12" } });
    fireEvent.change(screen.getByLabelText(/Service rendu du/), { target: { value: "2026-01-01" } });
    await user.type(screen.getByLabelText(/au \(exclu\)/), "2026-04-01");
    await user.type(screen.getByLabelText(/Montant TTC/), "1200");
    await choose(/Mode de règlement/, /Banque/);
    await user.click(screen.getByRole("button", { name: "Enregistrer la dépense" }));

    await vi.waitFor(() => { expect(api.calls.some((call) => call.method === "POST")).toBe(true); });
    const post = api.calls.find((call) => call.method === "POST");
    expect(post?.path).toBe(org("/charges/expenses"));
    expect(post?.idempotencyKey).toMatch(/\S{8,}/);
    expect(post?.body).toMatchObject({ property_id: PROPERTY, settlement: "bank", payee_label: "Plomberie du Lac" });
  });
});

describe("finances de l'espace bailleur en mode démo", () => {
  it.each([
    ["dépenses", () => <DepensesPage />],
    ["régularisation par charges", () => <ChargesPage />],
    ["nouvel exercice", () => <ExerciceNouveauPage />],
    ["clés de répartition", () => <ClesPage />],
    ["pointage bancaire", () => <BanquePage />],
    ["comptes bancaires", () => <ComptesPage />],
    ["relevés", () => <RelevesPage />],
    ["états de rapprochement", () => <EtatsPage />],
    ["import d'un relevé", () => <ImportBanquePage />],
  ])("ne sert pas %s hors mode api, sans appel réseau", async (_name, element) => {
    env.mode = "demo";
    const api = stubApi();

    expect(() => renderInSpace(element())).toThrow(/NEXT_NOT_FOUND/);
    await Promise.resolve();
    expect(api.paths()).toEqual([]);
  });

  it.each([
    ["en mode démo", "demo", EXPENSE],
    ["pour un identifiant qui n'est pas un slug", "api", "../etc"],
  ] as const)("l'accès à une fiche est introuvable %s, sans appel réseau", async (_name, mode, id) => {
    env.mode = mode;
    const api = stubApi();

    await expect(Resolved({ params: Promise.resolve({ id }), children: () => null })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(api.paths()).toEqual([]);
  });

  it.each([
    ["saisie d'une dépense", () => <DepenseNouvellePage />],
    ["régularisation", () => <RegularisationPage />],
    ["import bancaire", () => <ImportBancairePage />],
  ])("garde l'écran de démonstration pour %s, sans appel réseau", async (_name, element) => {
    env.mode = "demo";
    const api = stubApi();

    renderInSpace(element());

    await Promise.resolve();
    expect(api.paths().filter((path) => path.startsWith("/api/v1/org/"))).toEqual([]);
  });
});
