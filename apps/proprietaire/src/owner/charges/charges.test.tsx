import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApi, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { currentLocation, replace, setLocation } from "../../../test/navigation";
import { ACCESS_ENTRY, SECOND_ACCESS_ENTRY, problem } from "../responses.fixtures";
import { one } from "../shared/fixtures";
import { ChargeStatementScreen } from "./ChargeStatementScreen";
import { ChargeStatementsScreen } from "./ChargeStatementsScreen";
import { STATEMENT_DETAIL, STATEMENT_DUE, STATEMENT_ID, STATEMENT_REFUND, STATEMENT_SUPERSEDED, STATEMENT_XOF, SECOND_STATEMENT_ID, statementsPage } from "./fixtures";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const LIST = "GET /api/v1/owner/charge-statements";
const DETAIL = `GET /api/v1/owner/charge-statements/${STATEMENT_ID}`;
const TWO_AGENCIES = { "GET /api/v1/owner/agencies": { body: { data: [ACCESS_ENTRY, SECOND_ACCESS_ENTRY] } } };
const DEMO_TEXTS = ["Koffi Adjovi", "Gestion Les Tilleuls", "Apt A1", "Mutuelle Horizon"];

beforeEach(() => {
  replace.mockClear();
  setLocation("/confie/charges");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("liste des décomptes de charges en mode api", () => {
  it("affiche les décomptes du serveur, sans PDF ni donnée de démonstration", async () => {
    const stub = stubApi({ [LIST]: { body: statementsPage([STATEMENT_DUE, STATEMENT_REFUND, STATEMENT_SUPERSEDED]) } });
    const { container } = renderApi(<ChargeStatementsScreen />);

    const table = await screen.findByRole("table", { name: "Décomptes de charges de vos lots confiés" });
    expect(within(table).getByRole("link", { name: "Décompte DC-2026-0004" }).getAttribute("href")).toBe(`/confie/charges/${STATEMENT_ID}`);
    expect(within(table).getAllByText("Agence du Lac")).toHaveLength(3);
    expect(within(table).getByText("A1 · Résidence Les Filaos")).toBeTruthy();
    expect(within(table).getAllByText("Du 01/01/2025 au 31/12/2025")).toHaveLength(3);
    expect(within(table).getByText("Awa Diallo, Moussa Diallo")).toBeTruthy();
    expect(within(table).getByText("482,50 €")).toBeTruthy();
    expect(within(table).getByText("360 €")).toBeTruthy();
    expect(within(table).getAllByText("Émis le 10/02/2026")).toHaveLength(2);
    expect(within(table).getByText("Remplacé par un rectificatif")).toBeTruthy();
    expect(within(table).getAllByText("Émis")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /pdf|télécharger/i })).toBeNull();
    expect(container.querySelector("a[download]")).toBeNull();
    expect(stub.calls.filter((call) => call.path.includes("charge-statements")).every((call) => call.method === "GET")).toBe(true);
    expect(stub.calls.find((call) => call.path === "/api/v1/owner/charge-statements")?.query).toEqual({});
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it("formule le solde du locataire selon son signe", async () => {
    stubApi({ [LIST]: { body: statementsPage([STATEMENT_DUE, STATEMENT_REFUND, STATEMENT_SUPERSEDED]) } });
    renderApi(<ChargeStatementsScreen />);

    const table = await screen.findByRole("table", { name: "Décomptes de charges de vos lots confiés" });
    expect(within(table).getByText("À payer par le locataire : 122,50 €")).toBeTruthy();
    expect(within(table).getByText("À rendre au locataire : 117,50 €")).toBeTruthy();
    expect(within(table).getByText("Soldé")).toBeTruthy();
    expect(table.textContent).not.toContain("-117,50");
    expect(table.textContent).not.toContain("−117,50");
  });

  it("garde la devise du serveur et les francs sans décimales", async () => {
    stubApi({ [LIST]: { body: statementsPage([STATEMENT_XOF]) } });
    renderApi(<ChargeStatementsScreen />);

    const table = await screen.findByRole("table", { name: "Décomptes de charges de vos lots confiés" });
    expect(within(table).getByText(/^À rendre au locataire : 120\s000\sF\sCFA$/)).toBeTruthy();
    expect(table.textContent).not.toContain("€");
    expect(table.textContent).not.toMatch(/\d,\d\d\sF\sCFA/);
  });

  it("remplace un nom ou un bien absent par une mention neutre", async () => {
    stubApi({ [LIST]: { body: statementsPage([STATEMENT_SUPERSEDED]) } });
    renderApi(<ChargeStatementsScreen />);

    const table = await screen.findByRole("table", { name: "Décomptes de charges de vos lots confiés" });
    expect(within(table).getAllByText("Non renseigné")).toHaveLength(2);
    expect(within(table).queryByText(/^Émis le/)).toBeNull();
  });

  it("charge la page suivante avec le curseur du serveur", async () => {
    const stub = stubApi({ [LIST]: (call) => ({ body: call.query.cursor === "c2" ? statementsPage([STATEMENT_REFUND]) : statementsPage([STATEMENT_DUE], "c2") }) });
    const { user } = renderApi(<ChargeStatementsScreen />);

    await user.click(await screen.findByRole("button", { name: "Afficher la suite" }));

    expect(await screen.findByRole("link", { name: "Décompte DC-2026-0005" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Décompte DC-2026-0004" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Afficher la suite" })).toBeNull();
    expect(stub.calls.filter((call) => call.path === "/api/v1/owner/charge-statements").map((call) => call.query.cursor)).toEqual([undefined, "c2"]);
  });

  it("restreint à une agence, garde le choix dans l'adresse et le transmet au serveur", async () => {
    const stub = stubApi({ ...TWO_AGENCIES, [LIST]: { body: statementsPage([STATEMENT_DUE]) } });
    const { user } = renderApi(<ChargeStatementsScreen />);

    await screen.findByRole("link", { name: "Décompte DC-2026-0004" });
    await user.click(screen.getByRole("combobox", { name: /Agence/ }));
    await user.click(await screen.findByRole("option", { name: "Cabinet Horizon" }));

    await waitFor(() => {
      expect(stub.calls.some((call) => call.path === "/api/v1/owner/charge-statements" && call.query.agency === SECOND_ACCESS_ENTRY.agency.id)).toBe(true);
    });
    expect(currentLocation().search).toBe(`agency=${SECOND_ACCESS_ENTRY.agency.id}`);
  });

  it("n'affiche aucun filtre quand le mandant n'a qu'une agence", async () => {
    stubApi({ [LIST]: { body: statementsPage([STATEMENT_DUE]) } });
    renderApi(<ChargeStatementsScreen />);

    await screen.findByRole("link", { name: "Décompte DC-2026-0004" });
    expect(screen.queryByRole("combobox", { name: /Agence/ })).toBeNull();
  });

  it("n'interroge pas le serveur pour une agence hors de vos accès", async () => {
    setLocation("/confie/charges", "agency=0193a5e1-0000-7000-8000-0000000000ff");
    const stub = stubApi({ ...TWO_AGENCIES, [LIST]: { body: statementsPage([STATEMENT_DUE]) } });
    renderApi(<ChargeStatementsScreen />);

    expect(await screen.findByText("Cette agence n’est plus accessible depuis votre espace.")).toBeTruthy();
    expect(stub.count("GET", "/api/v1/owner/charge-statements")).toBe(0);
  });

  it("affiche un état vide", async () => {
    stubApi({ [LIST]: { body: statementsPage([]) } });
    const { container } = renderApi(<ChargeStatementsScreen />);

    expect(await screen.findByText("Aucun décompte de charges")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("affiche un chargement avant la réponse", async () => {
    stubApi({ [LIST]: () => ({ body: statementsPage([]) }) });
    renderApi(<ChargeStatementsScreen />);

    expect(await screen.findByRole("status", { name: "Chargement de vos décomptes de charges" })).toBeTruthy();
    await screen.findByText("Aucun décompte de charges");
  });

  it.each([
    ["403", problem(403, "space_forbidden"), "Votre compte n’a pas ou plus d’accès à un espace propriétaire.", false],
    ["429", { ...problem(429, "too_many"), headers: { "Retry-After": "30" } }, "Trop de demandes en peu de temps. Patientez 30 s avant de réessayer.", false],
    ["503", problem(503, "unavailable"), "Le service est momentanément indisponible. Réessayez dans un instant.", true],
  ] as const)("traduit l'erreur %s en français clair", async (_status, reply, message, retry) => {
    stubApi({ [LIST]: reply });
    renderApi(<ChargeStatementsScreen />);

    expect(await screen.findByText("Vos décomptes de charges n’ont pas pu être chargés")).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Réessayer" }) !== null).toBe(retry);
  });

  it("signale un serveur injoignable et propose de réessayer", async () => {
    stubApi();
    renderApi(<ChargeStatementsScreen />);

    expect(await screen.findByText("Vos décomptes de charges n’ont pas pu être chargés")).toBeTruthy();
    expect(screen.getByText(/injoignable/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
  });

  it("refuse une réponse qui n'a pas la forme annoncée", async () => {
    stubApi({ [LIST]: { body: { data: [{ ...STATEMENT_DUE, balance: { amount: 12.5, currency: "EUR" } }], next_cursor: null } } });
    renderApi(<ChargeStatementsScreen />);

    expect(await screen.findByText("Le serveur a répondu de façon inattendue. Réessayez dans un instant.")).toBeTruthy();
  });
});

describe("détail d'un décompte de charges en mode api", () => {
  it("détaille les postes et les totaux du serveur sans PDF", async () => {
    const stub = stubApi({ [DETAIL]: { body: one(STATEMENT_DETAIL) } });
    const { container } = renderApi(<ChargeStatementScreen id={STATEMENT_ID} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Décompte DC-2026-0004" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Décomptes de charges" }).getAttribute("href")).toBe("/confie/charges");
    const summary = screen.getByRole("region", { name: "Décompte" });
    expect(within(summary).getByText("A1 · Résidence Les Filaos")).toBeTruthy();
    expect(within(summary).getByText("Awa Diallo, Moussa Diallo")).toBeTruthy();
    expect(within(summary).getByText("Du 01/01/2025 au 31/12/2025")).toBeTruthy();
    expect(within(summary).getByText("10/02/2026")).toBeTruthy();
    const lines = screen.getByRole("table", { name: "Postes de charges du décompte" });
    expect(within(lines).getByText("Eau froide")).toBeTruthy();
    expect(within(lines).getByText("Consommation")).toBeTruthy();
    expect(within(lines).getByText("Tantièmes 64/1 000")).toBeTruthy();
    expect(within(lines).getByText("Surface 64,2 m²")).toBeTruthy();
    expect(within(lines).getByText("1 200 €")).toBeTruthy();
    expect(within(lines).getAllByText("365")).toHaveLength(3);
    expect(within(lines).getByText("210 €")).toBeTruthy();
    const balance = screen.getByRole("region", { name: "Solde" });
    expect(within(balance).getByText("482,50 €")).toBeTruthy();
    expect(within(balance).getByText("360 €")).toBeTruthy();
    expect(within(balance).getByText("À payer par le locataire : 122,50 €")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /pdf|télécharger/i })).toBeNull();
    expect(container.querySelector("a[download]")).toBeNull();
    expect(stub.calls.filter((call) => call.path.includes("charge-statements")).map((call) => `${call.method} ${call.path}`)).toEqual([`GET /api/v1/owner/charge-statements/${STATEMENT_ID}`]);
    await expectNoA11yViolations(container);
  });

  it("formule un solde négatif comme une somme à rendre au locataire", async () => {
    stubApi({ [`GET /api/v1/owner/charge-statements/${SECOND_STATEMENT_ID}`]: { body: one({ ...STATEMENT_DETAIL, ...STATEMENT_REFUND }) } });
    renderApi(<ChargeStatementScreen id={SECOND_STATEMENT_ID} />);

    const balance = await screen.findByRole("region", { name: "Solde" });
    expect(within(balance).getByText("À rendre au locataire : 117,50 €")).toBeTruthy();
    expect(balance.textContent).not.toContain("À payer par le locataire");
    expect(balance.textContent).not.toContain("-117,50");
  });

  it("signale un décompte remplacé par un rectificatif", async () => {
    stubApi({ [DETAIL]: { body: one({ ...STATEMENT_DETAIL, ...STATEMENT_SUPERSEDED, id: STATEMENT_ID }) } });
    renderApi(<ChargeStatementScreen id={STATEMENT_ID} />);

    expect(await screen.findByText("Remplacé par un rectificatif")).toBeTruthy();
    expect(screen.getByText("Soldé")).toBeTruthy();
  });

  it("affiche un chargement avant la réponse", async () => {
    stubApi({ [DETAIL]: { body: one(STATEMENT_DETAIL) } });
    renderApi(<ChargeStatementScreen id={STATEMENT_ID} />);

    expect(await screen.findByRole("status", { name: "Chargement du décompte de charges" })).toBeTruthy();
    await screen.findByRole("heading", { level: 1, name: "Décompte DC-2026-0004" });
  });

  it("signale un décompte introuvable", async () => {
    stubApi({ [DETAIL]: problem(404, "charge_statement_not_found") });
    renderApi(<ChargeStatementScreen id={STATEMENT_ID} />);

    expect(await screen.findByText("Ce décompte de charges n’existe pas ou n’est plus accessible depuis votre espace.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour aux décomptes de charges" }).getAttribute("href")).toBe("/confie/charges");
    expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
  });

  it.each([
    ["403", problem(403, "space_forbidden"), "Votre compte n’a pas ou plus d’accès à un espace propriétaire."],
    ["429", { ...problem(429, "too_many"), headers: { "Retry-After": "120" } }, "Trop de demandes en peu de temps. Patientez 2 min avant de réessayer."],
    ["503", problem(503, "unavailable"), "Le service est momentanément indisponible. Réessayez dans un instant."],
  ] as const)("traduit l'erreur %s en français clair", async (_status, reply, message) => {
    stubApi({ [DETAIL]: reply });
    renderApi(<ChargeStatementScreen id={STATEMENT_ID} />);

    expect(await screen.findByText("Ce décompte de charges n’a pas pu être chargé")).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
  });

  it("signale un serveur injoignable", async () => {
    stubApi();
    renderApi(<ChargeStatementScreen id={STATEMENT_ID} />);

    expect(await screen.findByText("Ce décompte de charges n’a pas pu être chargé")).toBeTruthy();
    expect(screen.getByText(/injoignable/)).toBeTruthy();
  });
});
