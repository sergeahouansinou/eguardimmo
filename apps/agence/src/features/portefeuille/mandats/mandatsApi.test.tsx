import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetNavigation, router } from "../../../../test/navigation";
import { createApiPortefeuilleSource } from "../api/apiPortefeuille";
import { createApiMandatesSource } from "../api/mandatesSource";
import { ID, ORG, mandantRow, mandateDetail, mandateSummary, mockApi, orgPath, page, problem, unitLine, xofTermsJson } from "../api/testing";
import type { MockRoute } from "../api/testing";
import { pickOption, renderPortefeuille } from "../testing";
import { MandatDetailPage } from "./MandatDetailPage";
import { MandatFormPage } from "./MandatFormPage";
import { MandatsPage } from "./MandatsPage";
import { MandatTerminationPage } from "./MandatTerminationPage";

vi.mock("next/navigation", async () => (await import("../../../../test/navigation")).navigationMock());

const NOW = new Date(2026, 10, 16, 10, 0, 0);
const DEMO_TEXTS = ["Sophie Delmas", "Cabinet Delmas", "Marc Chevalier", "Anaïs Roux", "Apt 12", "M-2025-0142"];
const mandatePath = (suffix = "") => orgPath(`/mandates/${ID.mandate}${suffix}`);
const detail = (overrides = {}, status = 200) => ({ status, body: { data: mandateDetail(overrides) } });

interface Setup {
  canWrite?: boolean;
  summaries?: Record<string, unknown>[];
  routes?: Record<string, MockRoute>;
}

function renderApi(ui: ReactElement, { canWrite = true, summaries = [mandateSummary()], routes = {} }: Setup = {}) {
  const api = mockApi({
    [`GET ${orgPath("/mandates")}`]: (call) => ({ body: page(call.search.get("archived") === "1" ? [mandateSummary({ id: ID.archived, reference: "M-2025-0009", status: "terminated", end_date: "2026-05-31", archived_at: "2026-06-01T08:00:00+00:00" })] : summaries) }),
    [`GET ${orgPath("/mandates/mandants")}`]: { body: { data: [mandantRow()] } },
    [`GET ${mandatePath()}`]: detail(),
    [`GET ${mandatePath("/end-request")}`]: { body: { data: null } },
    ...routes,
  });
  const mandates = createApiMandatesSource({ client: api.client, organizationId: ORG });
  const source = createApiPortefeuilleSource({ mandates, agencyName: "Agence Soleil", canWrite, now: () => NOW });
  return { ...api, ...renderPortefeuille(ui, source) };
}

beforeEach(() => {
  resetNavigation();
});

describe("liste des mandats en mode api", () => {
  it("affiche les mandats du serveur sans aucun texte de démonstration", async () => {
    const { callsTo } = renderApi(<MandatsPage />);

    const table = await screen.findByRole("table", { name: "Liste des mandats" });

    expect(within(table).getByText("M-2026-0001")).toBeTruthy();
    expect(within(table).getByText("Claire Vasseur")).toBeTruthy();
    expect(within(table).getByText("1 lot")).toBeTruthy();
    expect(within(table).getByText("7 %")).toBeTruthy();
    expect(document.body.textContent).not.toContain("TTC");
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    expect(callsTo("GET", orgPath("/mandates")).length).toBeGreaterThan(0);
  });

  it("range les mandats archivés dans leur segment", async () => {
    const user = userEvent.setup();
    renderApi(<MandatsPage />);

    await user.click(await screen.findByRole("tab", { name: /Archivés/ }));

    expect(within(screen.getByRole("table", { name: "Liste des mandats" })).getByText("M-2025-0009")).toBeTruthy();
    expect(screen.queryByText("M-2026-0001")).toBeNull();
  });

  it("propose la création et les actions d'écriture à un gestionnaire", async () => {
    const user = userEvent.setup();
    renderApi(<MandatsPage />);

    expect(await screen.findByRole("link", { name: /Nouveau mandat/ })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Actions pour le mandat M-2026-0001" }));

    expect(await screen.findByRole("menuitem", { name: "Suspendre le mandat" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /Télécharger/ })).toBeNull();
  });

  it("n'offre aucune action d'écriture à un comptable", async () => {
    const user = userEvent.setup();
    renderApi(<MandatsPage />, { canWrite: false });

    await screen.findByRole("table", { name: "Liste des mandats" });
    expect(screen.queryByRole("link", { name: /Nouveau mandat/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Actions pour le mandat M-2026-0001" }));

    expect(await screen.findByRole("menuitem", { name: "Voir le mandat" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /Suspendre|Archiver|Activer|Mettre fin/ })).toBeNull();
  });

  it("suspend un mandat avec sa version puis recharge la liste", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderApi(<MandatsPage />, { routes: { [`POST ${mandatePath("/suspend")}`]: detail({ status: "suspended", lock_version: 4 }) } });
    await user.click(await screen.findByRole("button", { name: "Actions pour le mandat M-2026-0001" }));
    await user.click(await screen.findByRole("menuitem", { name: "Suspendre le mandat" }));
    const before = callsTo("GET", orgPath("/mandates")).length;

    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Suspendre le mandat" }));

    await waitFor(() => { expect(callsTo("POST", mandatePath("/suspend"))).toHaveLength(1); });
    expect(callsTo("POST", mandatePath("/suspend"))[0]?.body).toEqual({ lock_version: 3 });
    await waitFor(() => { expect(callsTo("GET", orgPath("/mandates")).length).toBeGreaterThan(before); });
    expect(await screen.findByText("Mandat M-2026-0001 suspendu")).toBeTruthy();
  });

  it("explique le chevauchement quand l'activation échoue sur un lot déjà couvert", async () => {
    const user = userEvent.setup();
    renderApi(<MandatsPage />, {
      summaries: [mandateSummary({ status: "draft" })],
      routes: { [`POST ${mandatePath("/activate")}`]: problem(409, "mandate_overlap", "Chevauchement") },
    });
    await user.click(await screen.findByRole("tab", { name: /Brouillons/ }));
    await user.click(await screen.findByRole("button", { name: "Actions pour le mandat M-2026-0001" }));
    await user.click(await screen.findByRole("menuitem", { name: "Activer le mandat" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Date de signature"), "2026-11-13");

    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

    expect(await within(dialog).findByText(/Un autre mandat de votre agence couvre déjà un de ces lots/)).toBeTruthy();
  });

  it("propose de recharger et relit la liste après un conflit de version", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderApi(<MandatsPage />, {
      summaries: [mandateSummary({ status: "draft" })],
      routes: { [`POST ${mandatePath("/activate")}`]: problem(409, "mandate_stale_version", "Périmée") },
    });
    await user.click(await screen.findByRole("tab", { name: /Brouillons/ }));
    await user.click(await screen.findByRole("button", { name: "Actions pour le mandat M-2026-0001" }));
    await user.click(await screen.findByRole("menuitem", { name: "Activer le mandat" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Date de signature"), "2026-11-13");
    const before = callsTo("GET", orgPath("/mandates")).length;

    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

    expect(await within(dialog).findByText(/Rechargez-le pour voir sa dernière version/)).toBeTruthy();
    await waitFor(() => { expect(callsTo("GET", orgPath("/mandates")).length).toBeGreaterThan(before); });
  });

  it("signale le refus d'un rôle sans droit quand le serveur répond 403", async () => {
    const user = userEvent.setup();
    renderApi(<MandatsPage />, { routes: { [`POST ${mandatePath("/suspend")}`]: problem(403, "role_forbidden", "Interdit") } });
    await user.click(await screen.findByRole("button", { name: "Actions pour le mandat M-2026-0001" }));
    await user.click(await screen.findByRole("menuitem", { name: "Suspendre le mandat" }));

    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Suspendre le mandat" }));

    expect(await screen.findByText(/Votre rôle ne permet pas de modifier les mandats/)).toBeTruthy();
  });
});

describe("fiche mandat en mode api", () => {
  it("dit « Non disponible » pour ce que l'API ne porte pas, sans valeur inventée", async () => {
    renderApi(<MandatDetailPage id={ID.mandate} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Mandat M-2026-0001" })).toBeTruthy();
    expect(screen.getAllByText(/Non disponible/).length).toBeGreaterThan(3);
    expect(screen.getByText("Mandat de gestion")).toBeTruthy();
    expect(document.body.textContent).not.toContain("TTC");
    expect(document.body.textContent).not.toContain("Garantie financière, valable");
    expect(screen.queryByRole("button", { name: /Télécharger/ })).toBeNull();
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
  });

  it("affiche un mandat en FCFA sans erreur ni conversion en euros", async () => {
    const terms = xofTermsJson();
    const user = userEvent.setup();
    renderApi(<MandatDetailPage id={ID.mandate} />, {
      summaries: [mandateSummary({ currency: "XOF", terms, status: "draft" })],
      routes: { [`GET ${mandatePath()}`]: detail({ currency: "XOF", terms, terms_history: [terms], status: "draft" }) },
    });

    await screen.findByRole("heading", { level: 1, name: "Mandat M-2026-0001" });

    expect(document.body.textContent).toContain("Jusqu'à 300\u00a0000\u00a0F\u00a0CFA");
    expect(document.body.textContent).not.toContain("€");
    await user.click((await screen.findAllByRole("button", { name: "Modifier" }))[0] ?? document.body);
    const works = await screen.findByRole("textbox", { name: /Travaux sans accord/ });
    expect((works as HTMLInputElement).value).toBe("300000");
  });

  it("affiche un brouillon sans conditions (terms: null) sans faire échouer le portefeuille", async () => {
    const brouillon = mandateSummary({ id: ID.archived, reference: "M-2026-0002", status: "draft", terms: null });
    renderApi(<MandatsPage />, { summaries: [mandateSummary(), brouillon] });

    const actifs = await screen.findByRole("table", { name: "Liste des mandats" });
    expect(within(actifs).getByText("M-2026-0001")).toBeTruthy();
    expect(within(actifs).getByText("7 %")).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: /Brouillons/ }));

    const table = await screen.findByRole("table", { name: "Liste des mandats" });
    const row = (await within(table).findByText("M-2026-0002")).closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getAllByText("Conditions non renseignées")).toHaveLength(2);
    expect(screen.queryByText(/réponse inattendue|Impossible de charger/i)).toBeNull();
  });

  it("ouvre la fiche d'un brouillon sans conditions et indique qu'elles ne sont pas renseignées", async () => {
    renderApi(<MandatDetailPage id={ID.mandate} />, {
      summaries: [mandateSummary({ status: "draft", terms: null })],
      routes: { [`GET ${mandatePath()}`]: detail({ status: "draft", terms: null, terms_history: [] }) },
    });

    await screen.findByRole("heading", { level: 1, name: "Mandat M-2026-0001" });

    expect(document.body.textContent).toContain("Conditions non renseignées");
    expect(document.body.textContent).not.toContain("Jusqu'à");
    expect(document.body.textContent).not.toContain("0 %");
  });

  it("n'affiche ni modification ni avenant à un comptable", async () => {
    renderApi(<MandatDetailPage id={ID.mandate} />, { canWrite: false });

    await screen.findByRole("heading", { level: 1, name: "Mandat M-2026-0001" });

    expect(screen.queryByRole("button", { name: "Modifier" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Ajouter un avenant/ })).toBeNull();
  });

  it("liste les lots du mandat et ajoute un lot avec la version courante", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderApi(<MandatDetailPage id={ID.mandate} />, {
      routes: {
        [`GET ${orgPath("/parties")}`]: { body: page([]) },
        [`GET ${orgPath("/units")}`]: { body: page([{ id: ID.unitA, reference: "A12", property: { id: ID.property, name: "Résidence du Port" }, archived_at: null }, { id: ID.unitB, reference: "B07", property: { id: ID.property, name: "Résidence du Port" }, archived_at: null }]) },
        [`GET ${orgPath("/catalog/vocabularies/mandate_type/terms")}`]: { body: { data: [] } },
        [`POST ${mandatePath("/units")}`]: detail({ lock_version: 4, units: [unitLine(), unitLine({ id: ID.lineB, unit: { id: ID.unitB, reference: "B07", property: { id: ID.property, name: "Résidence du Port" } } })] }, 201),
      },
    });
    await screen.findByRole("heading", { level: 1, name: "Mandat M-2026-0001" });
    await user.click(screen.getByRole("tab", { name: /Biens/ }));
    expect(within(await screen.findByRole("table", { name: "Lots du mandat" })).getByText("A12")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Ajouter un lot" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("combobox", { name: /Lot/ }));
    await user.click(await screen.findByRole("option", { name: /B07/ }));
    await user.click(within(dialog).getByRole("button", { name: "Ajouter le lot" }));

    await waitFor(() => { expect(callsTo("POST", mandatePath("/units"))).toHaveLength(1); });
    expect(callsTo("POST", mandatePath("/units"))[0]?.body).toEqual({ lock_version: 3, unit_id: ID.unitB });
  });

  it("montre l'historique des conditions du serveur", async () => {
    const user = userEvent.setup();
    renderApi(<MandatDetailPage id={ID.mandate} />);
    await screen.findByRole("heading", { level: 1, name: "Mandat M-2026-0001" });

    await user.click(screen.getByRole("tab", { name: /Historique/ }));

    expect(await screen.findAllByText("Conditions initiales")).not.toHaveLength(0);
  });

  it("signale un mandat introuvable quand le serveur répond 404", async () => {
    renderApi(<MandatDetailPage id={ID.other} />, { routes: { [`GET ${mandatePath().replace(ID.mandate, ID.other)}`]: problem(404, "mandate_not_found", "Introuvable") } });

    expect(await screen.findByRole("heading", { level: 1, name: "Mandat introuvable" })).toBeTruthy();
  });
});

describe("fin de mandat en mode api", () => {
  async function fill(user: ReturnType<typeof userEvent.setup>, reason: RegExp, effect: string) {
    await screen.findByRole("heading", { level: 1, name: /Mettre fin au mandat M-2026-0001/ });
    await pickOption(user, /Motif/, reason);
    await user.type(screen.getByLabelText(/Date d'effet/), effect);
  }

  it("résilie à l'amiable sans préavis, avec la version du mandat", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderApi(<MandatTerminationPage id={ID.mandate} />, { routes: { [`POST ${mandatePath("/terminate")}`]: detail({ status: "terminated", end_date: "2026-12-01", lock_version: 4 }, 200) } });
    await fill(user, /Accord amiable/, "2026-12-01");

    await user.click(screen.getByRole("button", { name: "Mettre fin au mandat" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirmer la fin du mandat" }));

    await waitFor(() => { expect(callsTo("POST", mandatePath("/terminate"))).toHaveLength(1); });
    expect(callsTo("POST", mandatePath("/terminate"))[0]?.body).toMatchObject({ lock_version: 3, notice_given_on: "2026-11-16", effective_on: "2026-12-01", amicable: true });
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith(`/mandats/${ID.mandate}`); });
  });

  it("applique le préavis du mandat et refuse une date trop proche sans appeler le serveur", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderApi(<MandatTerminationPage id={ID.mandate} />);
    await fill(user, /à l'initiative du mandant/, "2026-12-01");

    await user.click(screen.getByRole("button", { name: "Mettre fin au mandat" }));

    expect(await screen.findByText(/Le préavis est de 3 mois/)).toBeTruthy();
    expect(callsTo("POST", mandatePath("/terminate"))).toHaveLength(0);
  });

  it("refuse l'écran à un comptable", async () => {
    renderApi(<MandatTerminationPage id={ID.mandate} />, { canWrite: false });

    expect(await screen.findByText("Action réservée")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mettre fin au mandat" })).toBeNull();
  });
});

describe("nouveau mandat en mode api", () => {
  const options: Record<string, MockRoute> = {
    [`GET ${orgPath("/mandates/term-defaults")}`]: problem(404, "mandate_term_defaults_not_found", "Aucune condition par défaut."),
    [`GET ${orgPath("/parties")}`]: { body: page([{ id: ID.mandant, kind: "person", display_name: "Claire Vasseur", is_anonymized: false, archived_at: null }]) },
    [`GET ${orgPath("/units")}`]: { body: page([{ id: ID.unitA, reference: "A12", property: { id: ID.property, name: "Résidence du Port" }, archived_at: null }]) },
    [`GET ${orgPath("/catalog/vocabularies/mandate_type/terms")}`]: { body: { data: [{ id: ID.type, key: "gestion", labels: { fr: "Mandat de gestion" }, semantic_key: "management", archived: false }] } },
  };

  async function fill(user: ReturnType<typeof userEvent.setup>) {
    await pickOption(user, /Mandant/, /Claire Vasseur/);
    await pickOption(user, /Lot 1/, /A12/);
    await pickOption(user, /Base de calcul des honoraires/, /Loyer hors charges/);
    await user.type(screen.getByLabelText(/Dernier jour du mandat/), "2029-11-30");
  }

  it("enregistre un brouillon avec les lots réels choisis", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderApi(<MandatFormPage />, { routes: { ...options, [`POST ${orgPath("/mandates")}`]: detail({ status: "draft", lock_version: 1 }, 201) } });
    await screen.findByRole("heading", { level: 1, name: "Nouveau mandat" });
    await fill(user);

    await user.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));

    await waitFor(() => { expect(callsTo("POST", orgPath("/mandates"))).toHaveLength(1); });
    expect(callsTo("POST", orgPath("/mandates"))[0]?.body).toEqual({
      mandant_party_id: ID.mandant,
      mandate_type_term_id: ID.type,
      starts_on: "2026-11-16",
      end_date: "2029-11-30",
      tacit_renewal: false,
      currency: "EUR",
      terms: { fee_kind: "percentage", fee_basis_points: 700, payout_day: 5, works_limit_amount: 50_000, fee_base: "rent", fee_minimum_amount: 0, fee_tax_mode: "excl_tax" },
      units: [{ unit_id: ID.unitA }],
    });
    expect(callsTo("POST", mandatePath("/activate"))).toHaveLength(0);
    await waitFor(() => { expect(router.push).toHaveBeenCalledWith(`/mandats/${ID.mandate}`); });
  });

  it("n'envoie ni ne devine aucune base de calcul tant qu'elle n'est pas choisie", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderApi(<MandatFormPage />, { routes: options });
    await screen.findByRole("heading", { level: 1, name: "Nouveau mandat" });
    await pickOption(user, /Mandant/, /Claire Vasseur/);
    await pickOption(user, /Lot 1/, /A12/);
    await user.type(screen.getByLabelText(/Dernier jour du mandat/), "2029-11-30");

    await user.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));

    expect(await screen.findByText("Choisissez la base de calcul des honoraires.")).toBeTruthy();
    expect(callsTo("POST", orgPath("/mandates"))).toHaveLength(0);
  });

  it("crée un mandat en FCFA : montants entiers sans multiplication par 100", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderApi(<MandatFormPage />, { routes: { ...options, [`POST ${orgPath("/mandates")}`]: detail({ status: "draft", lock_version: 1 }, 201) } });
    await screen.findByRole("heading", { level: 1, name: "Nouveau mandat" });
    await fill(user);
    await pickOption(user, /Devise du mandat/, /Franc CFA/);
    await pickOption(user, /Honoraires exprimés/, /Toutes taxes comprises/);
    const works = screen.getByLabelText(/Travaux sans accord/);
    await user.clear(works);
    await user.type(works, "250 000");
    const minimum = screen.getByLabelText(/Minimum par mois/);
    await user.clear(minimum);
    await user.type(minimum, "5 000");

    await user.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));

    await waitFor(() => { expect(callsTo("POST", orgPath("/mandates"))).toHaveLength(1); });
    expect(callsTo("POST", orgPath("/mandates"))[0]?.body).toMatchObject({
      currency: "XOF",
      terms: { works_limit_amount: 250_000, fee_minimum_amount: 5_000, fee_tax_mode: "incl_tax", fee_base: "rent" },
    });
  });

  it("refuse des décimales sur un montant en FCFA", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderApi(<MandatFormPage />, { routes: options });
    await screen.findByRole("heading", { level: 1, name: "Nouveau mandat" });
    await fill(user);
    await pickOption(user, /Devise du mandat/, /Franc CFA/);
    const works = screen.getByLabelText(/Travaux sans accord/);
    await user.clear(works);
    await user.type(works, "250 000,5");

    await user.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));

    expect(await screen.findByText(/Saisissez un montant en francs CFA/)).toBeTruthy();
    expect(callsTo("POST", orgPath("/mandates"))).toHaveLength(0);
  });

  it("exige la date de signature pour activer, sans appeler le serveur", async () => {
    const user = userEvent.setup();
    const { callsTo } = renderApi(<MandatFormPage />, { routes: options });
    await screen.findByRole("heading", { level: 1, name: "Nouveau mandat" });
    await fill(user);

    await user.click(screen.getByRole("button", { name: "Créer et activer le mandat" }));

    expect(await screen.findByText(/Indiquez la date de signature pour activer le mandat/)).toBeTruthy();
    expect(callsTo("POST", orgPath("/mandates"))).toHaveLength(0);
  });

  it("affiche le chevauchement sous le champ des lots", async () => {
    const user = userEvent.setup();
    renderApi(<MandatFormPage />, { routes: { ...options, [`POST ${orgPath("/mandates")}`]: problem(409, "mandate_overlap", "Chevauchement") } });
    await screen.findByRole("heading", { level: 1, name: "Nouveau mandat" });
    await fill(user);

    await user.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));

    expect(await screen.findByText(/Un autre mandat de votre agence couvre déjà un de ces lots/)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("n'affiche aucun lot ni mandant de démonstration", async () => {
    renderApi(<MandatFormPage />, { routes: options });
    await screen.findByRole("heading", { level: 1, name: "Nouveau mandat" });

    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    expect(screen.queryByRole("textbox", { name: /Nom du lot/ })).toBeNull();
  });
});
