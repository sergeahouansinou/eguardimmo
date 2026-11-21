import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApi, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { captureDownloads } from "../../../test/download";
import { setLocation } from "../../../test/navigation";
import { ACCESS_ENTRY, SECOND_ACCESS_ENTRY, problem } from "../responses.fixtures";
import { one, page } from "../shared/fixtures";
import { INCOME, OLD_STATEMENT_ID, OTHER_AGENCY_STATEMENT, STATEMENT, STATEMENT_DETAIL, STATEMENT_ID, SUPERSEDED_STATEMENT } from "./fixtures";
import { TaxStatementScreen } from "./TaxStatementScreen";
import { TaxStatementsScreen } from "./TaxStatementsScreen";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const LIST = "GET /api/v1/owner/tax-statements";
const DETAIL = `GET /api/v1/owner/tax-statements/${STATEMENT_ID}`;
const PDF = `GET /api/v1/owner/tax-statements/${STATEMENT_ID}/pdf`;

beforeEach(() => {
  setLocation("/confie/fiscalite");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("relevés fiscaux du mandant en mode api", () => {
  it("liste les relevés publiés et remplacés avec les lignes 215 et 263 du serveur", async () => {
    stubApi({ [LIST]: { body: page([STATEMENT, SUPERSEDED_STATEMENT]) } });
    const { container } = renderApi(<TaxStatementsScreen />);

    const table = await screen.findByRole("table", { name: "Relevés fiscaux publiés" });
    expect(within(table).getAllByRole("link", { name: "2025" })[0]?.getAttribute("href")).toBe(`/confie/fiscalite/${STATEMENT_ID}`);
    expect(within(table).getByText("Publié")).toBeTruthy();
    expect(within(table).getByText("Remplacé")).toBeTruthy();
    expect(within(table).getAllByText(/12\s000\s€/)).toHaveLength(2);
    expect(within(table).getAllByText(/4\s100\s€/)).toHaveLength(2);
    expect(screen.getByText(/à faire valider par un expert-comptable/)).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("filtre par agence sans jamais envoyer d'organisation", async () => {
    const stub = stubApi({
      "GET /api/v1/owner/agencies": { body: { data: [ACCESS_ENTRY, SECOND_ACCESS_ENTRY] } },
      [LIST]: (call) => ({ body: page(call.query.agency === undefined ? [STATEMENT, OTHER_AGENCY_STATEMENT] : [STATEMENT]) }),
    });
    setLocation("/confie/fiscalite", "?agency=0193a5e1-0000-7000-8000-0000000000b1");
    renderApi(<TaxStatementsScreen />);

    await screen.findByRole("table", { name: "Relevés fiscaux publiés" });
    const call = stub.calls.find((entry) => entry.path === "/api/v1/owner/tax-statements");
    expect(call?.query).toEqual({ agency: "0193a5e1-0000-7000-8000-0000000000b1" });
  });

  it("charge la suite avec le curseur", async () => {
    const stub = stubApi({ [LIST]: (call) => ({ body: call.query.cursor === undefined ? page([STATEMENT], "next-1") : page([OTHER_AGENCY_STATEMENT]) }) });
    const { user } = renderApi(<TaxStatementsScreen />);

    await user.click(await screen.findByRole("button", { name: "Afficher la suite" }));

    await waitFor(() => { expect(stub.calls.some((call) => call.query.cursor === "next-1")).toBe(true); });
    expect(await screen.findAllByRole("link", { name: "2025" })).toHaveLength(2);
  });

  it("affiche un état vide", async () => {
    stubApi({ [LIST]: { body: page([]) } });
    renderApi(<TaxStatementsScreen />);

    expect(await screen.findByText("Aucun relevé fiscal")).toBeTruthy();
  });

  it.each([
    [401, "unauthenticated", "Votre session a expiré. Reconnectez-vous pour continuer."],
    [403, "space_forbidden", "Votre compte n’a pas ou plus d’accès à un espace propriétaire."],
    [429, "too_many_requests", null],
    [500, "server_error", null],
  ])("traduit l'erreur %i de la liste", async (status, code, message) => {
    stubApi({ [LIST]: problem(status, code) });
    renderApi(<TaxStatementsScreen />);

    expect(await screen.findByText("Vos relevés fiscaux n’ont pas pu être chargés")).toBeTruthy();
    if (message !== null) expect(screen.getByText(message)).toBeTruthy();
  });

  it("détaille un relevé : lignes, bases sans verdict, mentions et avertissements du serveur", async () => {
    stubApi({ [DETAIL]: { body: one(STATEMENT_DETAIL) } });
    const { container } = renderApi(<TaxStatementScreen id={STATEMENT_ID} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Revenus fonciers 2025" })).toBeTruthy();
    expect(screen.getByText(INCOME.warning)).toBeTruthy();
    expect(screen.getByText("Ce bien est détenu à plusieurs : vérifiez les quotes-parts avant de déclarer.")).toBeTruthy();
    expect(screen.getByText("Résidence des Filaos")).toBeTruthy();
    expect(screen.getByText(/sans recommandation de régime/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir la version remplacée" }).getAttribute("href")).toBe(`/confie/fiscalite/${OLD_STATEMENT_ID}`);
    expect(screen.queryByText(/Figer/)).toBeNull();
    await expectNoA11yViolations(container);
  });

  it("avertit qu'un relevé a été remplacé", async () => {
    stubApi({ [DETAIL]: { body: one({ ...STATEMENT_DETAIL, status: "superseded", supersedes_id: null }) } });
    renderApi(<TaxStatementScreen id={STATEMENT_ID} />);

    expect(await screen.findByText("Relevé remplacé")).toBeTruthy();
  });

  it("télécharge le PDF avec la session, sans lien public", async () => {
    const downloads = captureDownloads();
    const stub = stubApi({ [DETAIL]: { body: one(STATEMENT_DETAIL) }, [PDF]: { file: { type: "application/pdf", content: "%PDF-1.4 test" } } });
    const { user } = renderApi(<TaxStatementScreen id={STATEMENT_ID} />);

    await user.click(await screen.findByRole("button", { name: "Télécharger le PDF" }));

    await waitFor(() => { expect(downloads.names).toEqual(["releve-fiscal-2025.pdf"]); });
    expect(await downloads.blobs[0]?.text()).toBe("%PDF-1.4 test");
    const call = stub.calls.find((entry) => entry.path.endsWith("/pdf"));
    expect(call?.init?.credentials).toBe("include");
  });

  it("n'offre pas de PDF quand le serveur n'en a pas", async () => {
    stubApi({ [DETAIL]: { body: one({ ...STATEMENT_DETAIL, has_pdf: false }) } });
    renderApi(<TaxStatementScreen id={STATEMENT_ID} />);

    await screen.findByRole("heading", { level: 1, name: "Revenus fonciers 2025" });
    expect(screen.queryByRole("button", { name: "Télécharger le PDF" })).toBeNull();
  });

  it.each([
    [503, "tax_pdf_unavailable", "Le PDF de ce relevé fiscal n’est pas disponible pour le moment."],
    [429, "too_many_requests", null],
  ])("explique l'échec %i du PDF", async (status, code, message) => {
    const downloads = captureDownloads();
    stubApi({ [DETAIL]: { body: one(STATEMENT_DETAIL) }, [PDF]: problem(status, code) });
    const { user } = renderApi(<TaxStatementScreen id={STATEMENT_ID} />);

    await user.click(await screen.findByRole("button", { name: "Télécharger le PDF" }));

    const alert = await screen.findByRole("alert");
    if (message !== null) expect(alert.textContent).toContain(message);
    expect(downloads.names).toEqual([]);
  });

  it("signale un relevé non publié ou hors de vos accès (404)", async () => {
    stubApi({ [DETAIL]: problem(404, "tax_summary_not_found") });
    renderApi(<TaxStatementScreen id={STATEMENT_ID} />);

    expect(await screen.findByText("Ce relevé fiscal n’existe pas ou n’est pas publié.")).toBeTruthy();
  });

  it("refuse une réponse qui ne respecte pas le contrat", async () => {
    stubApi({ [DETAIL]: { body: one({ ...STATEMENT_DETAIL, status: "final" }) } });
    renderApi(<TaxStatementScreen id={STATEMENT_ID} />);

    expect(await screen.findByText("Ce relevé fiscal n’a pas pu être chargé")).toBeTruthy();
  });
});
