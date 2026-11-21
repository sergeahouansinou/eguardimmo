import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApi, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { captureDownloads } from "../../../test/download";
import { ACCESS_ENTRY, SECOND_ACCESS_ENTRY, problem } from "../responses.fixtures";
import { EMPTY_STATEMENT_RESPONSE, STATEMENT_RESPONSE } from "./fixtures";
import { StatementScreen } from "./StatementScreen";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const STATEMENT = "GET /api/v1/owner/statement";
const PATH = "/api/v1/owner/statement";
const CSV = { file: { type: "text/csv; charset=UTF-8", content: '"date";"reference"\r\n"2026-11-03";"JE-2026-0001"\r\n' } };
const statementCalls = (stub: ReturnType<typeof stubApi>) => stub.calls.filter((call) => call.path === PATH);

const rowAt = (rows: HTMLElement[], index: number): HTMLElement => {
  const row = rows[index];
  if (!row) throw new Error(`Ligne ${String(index)} absente`);
  return row;
};
const cell = (row: HTMLElement | undefined, header: string) => row?.querySelector(`td[data-label="${header}"]`)?.textContent.replace(/\s/g, " ");

function setPeriod(from: string, to: string) {
  fireEvent.change(screen.getByLabelText("Du"), { target: { value: from } });
  fireEvent.change(screen.getByLabelText("Au"), { target: { value: to } });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 19, 10, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("relevé de compte en mode api", () => {
  it("charge le mois en cours pour l'agence choisie et présente soldes et mouvements du serveur", async () => {
    const stub = stubApi({ [STATEMENT]: { body: STATEMENT_RESPONSE } });
    const { container } = renderApi(<StatementScreen />);

    const table = await screen.findByRole("table", { name: /Relevé du compte de Famille Dossou chez Agence du Lac, du 01\/11\/2026 au 30\/11\/2026/ });
    expect(statementCalls(stub).map((call) => call.query)).toEqual([{ from: "2026-11-01", to: "2026-11-30", agency: ACCESS_ENTRY.agency.id }]);
    expect(within(screen.getByRole("region", { name: "Solde au 01/11/2026, avant mouvements" })).getByText("0 €")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Solde au 30/11/2026" })).getByText("641,20 €")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Mouvements" })).getByText("4")).toBeTruthy();
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(5);
    expect(within(rowAt(rows, 1)).getByText("Loyer novembre 2026")).toBeTruthy();
    expect([cell(rows[1], "Débit"), cell(rows[1], "Crédit"), cell(rows[1], "Solde")]).toEqual(["—", "700 €", "700 €"]);
    expect([cell(rows[2], "Débit"), cell(rows[2], "Crédit"), cell(rows[2], "Solde")]).toEqual(["58,80 €", "—", "641,20 €"]);
    expect(within(rowAt(rows, 2)).getByText("Honoraires prélevés · JE-2026-0002")).toBeTruthy();
    expect(within(rowAt(rows, 3)).getByText("Annulation")).toBeTruthy();
    expect(cell(rows[3], "Solde")).toBe("-58,80 €");
    expect(document.body.textContent).not.toMatch(/fee_settlement|payment\b/);
    await expectNoA11yViolations(container);
  });

  it("demande une autre période et recharge le relevé", async () => {
    vi.useRealTimers();
    const stub = stubApi({ [STATEMENT]: { body: STATEMENT_RESPONSE } });
    const { user } = renderApi(<StatementScreen />);
    await screen.findByRole("table");

    setPeriod("2026-10-01", "2026-10-31");
    await user.click(screen.getByRole("button", { name: "Afficher le relevé" }));

    await waitFor(() => { expect(statementCalls(stub)).toHaveLength(2); });
    expect(statementCalls(stub)[1]?.query).toEqual({ from: "2026-10-01", to: "2026-10-31", agency: ACCESS_ENTRY.agency.id });
  });

  it.each([
    ["", "2026-11-30", "Indiquez la date de début"],
    ["2026-11-01", "", "Indiquez la date de fin"],
    ["2026-11-30", "2026-11-01", "La date de fin ne peut pas précéder celle de début."],
    ["2026-01-01", "2027-01-02", "La période ne peut pas dépasser 366 jours."],
  ])("refuse la période %s → %s sans interroger le serveur", async (from, to, message) => {
    vi.useRealTimers();
    const stub = stubApi({ [STATEMENT]: { body: STATEMENT_RESPONSE } });
    const { user } = renderApi(<StatementScreen />);
    await screen.findByRole("table");

    setPeriod(from, to);
    await user.click(screen.getByRole("button", { name: "Afficher le relevé" }));

    expect((await screen.findByRole("alert")).textContent).toContain(message);
    expect(statementCalls(stub)).toHaveLength(1);
  });

  it("accepte une période de 366 jours, bornes incluses", async () => {
    vi.useRealTimers();
    const stub = stubApi({ [STATEMENT]: { body: STATEMENT_RESPONSE } });
    const { user } = renderApi(<StatementScreen />);
    await screen.findByRole("table");

    setPeriod("2026-01-01", "2027-01-01");
    await user.click(screen.getByRole("button", { name: "Afficher le relevé" }));

    await waitFor(() => { expect(statementCalls(stub)).toHaveLength(2); });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("garde les soldes et affiche un état vide quand la période n'a aucun mouvement", async () => {
    stubApi({ [STATEMENT]: { body: EMPTY_STATEMENT_RESPONSE } });
    const { container } = renderApi(<StatementScreen />);

    expect(await screen.findByText("Aucun mouvement sur cette période")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Solde au 30/11/2026" })).getByText("641,20 €")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("nomme une opération inconnue sans afficher le code du serveur, et affiche le libellé comme du texte", async () => {
    const lines = [{ ...STATEMENT_RESPONSE.data.lines[0], source: "source_future", label: "<img src=x onerror=alert(1)>" }];
    stubApi({ [STATEMENT]: { body: { data: { ...STATEMENT_RESPONSE.data, lines } } } });
    renderApi(<StatementScreen />);

    expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(screen.getByText("Autre opération · JE-2026-0001")).toBeTruthy();
    expect(document.body.textContent).not.toContain("source_future");
    expect(document.querySelector("img[src='x']")).toBeNull();
  });
});

describe("export CSV du relevé", () => {
  it("télécharge le CSV authentifié de la période affichée, sous un nom de fichier assaini", async () => {
    vi.useRealTimers();
    const downloads = captureDownloads();
    const access = { ...ACCESS_ENTRY, mandant: { name: "Éléonore <O'Brien>/../Dossou" } };
    const stub = stubApi({ "GET /api/v1/owner/agencies": { body: { data: [access] } }, [STATEMENT]: (call) => (call.query.format === "csv" ? CSV : { body: STATEMENT_RESPONSE }) });
    const { user } = renderApi(<StatementScreen />);

    await user.click(await screen.findByRole("button", { name: "Exporter le relevé du 01/11/2026 au 30/11/2026 en CSV" }));

    await waitFor(() => { expect(downloads.names).toHaveLength(1); });
    expect(downloads.names[0]).toBe("releve-compte-Eleonore-O-Brien-Dossou-2026-11-01-2026-11-30.csv");
    expect(await downloads.blobs[0]?.text()).toContain('"2026-11-03";"JE-2026-0001"');
    const request = statementCalls(stub).find((call) => call.query.format === "csv");
    expect(request?.query).toEqual({ from: "2026-11-01", to: "2026-11-30", agency: ACCESS_ENTRY.agency.id, format: "csv" });
    expect(request?.init?.credentials).toBe("include");
  });

  it("annonce l'échec de l'export sans rien télécharger", async () => {
    vi.useRealTimers();
    const downloads = captureDownloads();
    stubApi({ [STATEMENT]: (call) => (call.query.format === "csv" ? problem(500, "boom") : { body: STATEMENT_RESPONSE }) });
    const { user } = renderApi(<StatementScreen />);

    await user.click(await screen.findByRole("button", { name: /en CSV$/ }));

    expect((await screen.findAllByRole("alert")).some((alert) => alert.textContent === "Une erreur est survenue. Réessayez dans un instant.")).toBe(true);
    expect(downloads.names).toEqual([]);
  });

  it("refuse une réponse JSON à la place du fichier", async () => {
    vi.useRealTimers();
    const downloads = captureDownloads();
    stubApi({ [STATEMENT]: () => ({ body: STATEMENT_RESPONSE }) });
    const { user } = renderApi(<StatementScreen />);

    await user.click(await screen.findByRole("button", { name: /en CSV$/ }));

    expect(await screen.findByText("Le serveur a répondu de façon inattendue. Réessayez dans un instant.")).toBeTruthy();
    expect(downloads.names).toEqual([]);
  });
});

describe("accès au relevé", () => {
  it("explique à un co-indivisaire que le relevé ne le concerne pas, sans interroger le serveur", async () => {
    const stub = stubApi({ "GET /api/v1/owner/agencies": { body: { data: [{ ...ACCESS_ENTRY, role: "co_owner", read_only: true }] } } });
    const { container } = renderApi(<StatementScreen />);

    expect(await screen.findByText("Relevé non accessible en tant que co-indivisaire")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Afficher le relevé" })).toBeNull();
    expect(statementCalls(stub)).toEqual([]);
    await expectNoA11yViolations(container);
  });

  it("affiche le même message quand le serveur refuse le rôle (403 owner_role_forbidden)", async () => {
    stubApi({ [STATEMENT]: problem(403, "owner_role_forbidden") });
    renderApi(<StatementScreen />);

    expect(await screen.findByText("Relevé non accessible en tant que co-indivisaire")).toBeTruthy();
    expect(screen.queryByText("Le relevé n’a pas pu être chargé")).toBeNull();
  });

  it("change d'agence avec le sélecteur et redemande le relevé de celle-ci", async () => {
    vi.useRealTimers();
    const stub = stubApi({ "GET /api/v1/owner/agencies": { body: { data: [ACCESS_ENTRY, SECOND_ACCESS_ENTRY] } }, [STATEMENT]: { body: STATEMENT_RESPONSE } });
    const { user } = renderApi(<StatementScreen />);
    await screen.findByRole("table");

    await user.click(screen.getByRole("combobox", { name: /Agence et mandant/ }));
    await user.click(await screen.findByRole("option", { name: /SCI Les Palmiers/ }));

    await waitFor(() => { expect(statementCalls(stub).map((call) => call.query.agency)).toEqual([ACCESS_ENTRY.agency.id, SECOND_ACCESS_ENTRY.agency.id]); });
  });

  it("affiche un état vide quand aucun mandat n'est relié", async () => {
    const stub = stubApi({ "GET /api/v1/owner/agencies": { body: { data: [] } } });
    renderApi(<StatementScreen />);

    expect(await screen.findByText("Aucun accès à un mandat")).toBeTruthy();
    expect(statementCalls(stub)).toEqual([]);
  });

  it.each([
    [problem(422, "statement_too_long"), "La période d’un relevé ne peut pas dépasser 366 jours. Raccourcissez-la."],
    [problem(422, "owner_agency_required"), "Votre compte a plusieurs mandats : choisissez l’agence à consulter."],
    [problem(404, "owner_agency_not_found"), "Cette agence n’est plus accessible depuis votre espace."],
  ])("traduit l'erreur %#", async (reply, message) => {
    stubApi({ [STATEMENT]: reply });
    renderApi(<StatementScreen />);

    expect(await screen.findByText("Le relevé n’a pas pu être chargé")).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
  });

  it("propose de réessayer après une panne puis affiche le relevé", async () => {
    vi.useRealTimers();
    let calls = 0;
    stubApi({ [STATEMENT]: () => (++calls === 1 ? problem(500, "boom") : { body: STATEMENT_RESPONSE }) });
    const { user } = renderApi(<StatementScreen />);

    await user.click(await screen.findByRole("button", { name: "Réessayer" }));

    expect(await screen.findByRole("table")).toBeTruthy();
  });

  it("signale une réponse hors contrat plutôt que d'afficher des soldes faux", async () => {
    stubApi({ [STATEMENT]: { body: { data: { ...STATEMENT_RESPONSE.data, closing_balance: { amount: "64120", currency: "EUR" } } } } });
    renderApi(<StatementScreen />);

    expect(await screen.findByText("Le relevé n’a pas pu être chargé")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
