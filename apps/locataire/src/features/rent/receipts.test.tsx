import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  REAL_IDS,
  receiptDetail,
  receiptNotFoundProblem,
  receiptVoidDetail,
  receiptVoidProblem,
  receiptsList,
  receiptsVoidList,
} from "@/tenant/rentResponses.fixtures";
import { expectNoA11yViolations } from "../../../test/axe";
import { renderApi, stubApi } from "../../../test/api";
import { ReceiptDetailScreen } from "./ReceiptDetailScreen";
import { ReceiptsScreen } from "./ReceiptsScreen";
import { DEMO_TEXTS, LEASES_STUB, RENT, captureDownloads, choose, clone, nth, problem } from "./testKit";

const LIST = `GET ${RENT}/receipts`;
const SHOW = `GET ${RENT}/receipts/${REAL_IDS.receipt}`;
const PDF = `GET ${RENT}/receipts/${REAL_IDS.receipt}/download`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function rows() {
  const table = await screen.findByRole("table", { name: "Mes quittances" });
  return within(table).getAllByRole("row").slice(1);
}

describe("mes quittances", () => {
  it("liste les quittances valables avec leur téléchargement", async () => {
    stubApi({ ...LEASES_STUB, [LIST]: { body: receiptsList } });

    const { container } = renderApi(<ReceiptsScreen />, { pathname: "/loyers/quittances" });

    const row = nth(await rows(), 0);
    expect(within(row).getByRole("link", { name: "QT-2026-0001" }).getAttribute("href")).toBe(`/loyers/quittances/${REAL_IDS.receipt}`);
    expect(row.textContent).toContain("Novembre 2026");
    expect(row.textContent).toContain("BL-2026-99809");
    expect(row.textContent).toContain("16/11/2026");
    expect(row.textContent).toContain("650 €");
    expect(within(row).getByText("Valable")).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Télécharger la quittance QT-2026-0001" })).toBeTruthy();
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it("signale une quittance annulée et ne propose plus son PDF", async () => {
    stubApi({ ...LEASES_STUB, [LIST]: { body: receiptsVoidList } });

    renderApi(<ReceiptsScreen />, { pathname: "/loyers/quittances" });

    const row = nth(await rows(), 0);
    expect(within(row).getByText("Annulée")).toBeTruthy();
    expect(within(row).queryByText("Valable")).toBeNull();
    expect(within(row).queryByRole("button")).toBeNull();
    expect(within(row).getByRole("link", { name: "QT-2026-0001" })).toBeTruthy();
  });

  it("télécharge le PDF par le client authentifié", async () => {
    const saved = captureDownloads();
    const api = stubApi({ ...LEASES_STUB, [LIST]: { body: receiptsList }, [PDF]: { pdf: "%PDF-1.4 quittance" } });

    const { user } = renderApi(<ReceiptsScreen />, { pathname: "/loyers/quittances" });
    await user.click(await screen.findByRole("button", { name: "Télécharger la quittance QT-2026-0001" }));

    await waitFor(() => { expect(saved).toHaveLength(1); });
    expect(saved[0]?.download).toBe("Quittance-QT-2026-0001.pdf");
    expect(api.calls.find((call) => call.path.endsWith("/download"))?.headers.accept).toBe("application/pdf");
  });

  it("explique le refus 409 d’une quittance annulée entre-temps", async () => {
    const saved = captureDownloads();
    stubApi({ ...LEASES_STUB, [LIST]: { body: receiptsList }, [PDF]: { status: 409, body: receiptVoidProblem } });

    const { user } = renderApi(<ReceiptsScreen />, { pathname: "/loyers/quittances" });
    await user.click(await screen.findByRole("button", { name: "Télécharger la quittance QT-2026-0001" }));

    expect(await screen.findByText("Le téléchargement a échoué")).toBeTruthy();
    expect(screen.getByText("Cette quittance a été annulée : son PDF n’est plus délivré.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
    expect(saved).toHaveLength(0);
  });

  it("filtre par bail côté serveur", async () => {
    const api = stubApi({ ...LEASES_STUB, [LIST]: { body: receiptsList } });

    const { user } = renderApi(<ReceiptsScreen />, { pathname: "/loyers/quittances" });
    await rows();
    await choose(user, "Bail", "BL-2026-99809");

    await waitFor(() => {
      expect(api.calls.filter((call) => call.path === `${RENT}/receipts`).map((call) => call.query.lease)).toEqual([undefined, REAL_IDS.lease]);
    });
  });

  it("annonce l’absence de quittance", async () => {
    stubApi({ ...LEASES_STUB, [LIST]: { body: { ...clone(receiptsList), data: [] } } });

    renderApi(<ReceiptsScreen />, { pathname: "/loyers/quittances" });

    expect(await screen.findByText("Aucune quittance pour le moment")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("charge la page suivante avec le curseur du serveur", async () => {
    const first = { ...clone(receiptsList), meta: { ...receiptsList.meta, next_cursor: "page-2" } };
    const api = stubApi({
      ...LEASES_STUB,
      [LIST]: (call) => ({ body: call.query.cursor === "page-2" ? receiptsList : first }),
    });

    const { user } = renderApi(<ReceiptsScreen />, { pathname: "/loyers/quittances" });
    await user.click(await screen.findByRole("button", { name: "Afficher plus de quittances" }));

    await waitFor(() => { expect(api.calls.filter((call) => call.path === `${RENT}/receipts`).map((call) => call.query.cursor)).toEqual([undefined, "page-2"]); });
    expect(await within(screen.getByRole("table", { name: "Mes quittances" })).findAllByRole("link", { name: "QT-2026-0001" })).toHaveLength(2);
  });

  it.each([
    [403, "space_forbidden", /pas ou plus d’accès/],
    [403, "email_unverified", /Confirmez votre adresse e-mail/],
    [429, "http_429", /Trop de demandes/],
  ])("explique une erreur %s %s", async (status, code, message) => {
    stubApi({ ...LEASES_STUB, [LIST]: { status, body: problem(status, code, "Erreur.") } });

    renderApi(<ReceiptsScreen />, { pathname: "/loyers/quittances" });

    expect(await screen.findByText("Vos quittances n’ont pas pu être chargées")).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
  });
});

describe("détail d’une quittance", () => {
  it("montre l’émetteur, les locataires, le lot et propose le PDF", async () => {
    const saved = captureDownloads();
    stubApi({ [SHOW]: { body: receiptDetail }, [PDF]: { pdf: "%PDF" } });

    const { container, user } = renderApi(<ReceiptDetailScreen id={REAL_IDS.receipt} />, { pathname: `/loyers/quittances/${REAL_IDS.receipt}` });

    expect(await screen.findByRole("heading", { level: 1, name: "Quittance QT-2026-0001" })).toBeTruthy();
    expect(screen.getByText("Valable")).toBeTruthy();
    expect(screen.getByText("Agence du Port")).toBeTruthy();
    expect(screen.getByText("Louis Carlier")).toBeTruthy();
    expect(screen.getByText("LOT-23892 · Résidence Fournier · 12 rue du Port, 13002 Marseille")).toBeTruthy();
    expect(screen.getByText("du 01/11/2026 au 30/11/2026")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir l’échéance" }).getAttribute("href")).toBe(`/loyers/echeances/${REAL_IDS.installment}`);
    expect(screen.getByRole("link", { name: "Voir le bail" }).getAttribute("href")).toBe(`/bail/${REAL_IDS.lease}`);
    expect(screen.queryByText("Quittance annulée")).toBeNull();
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole("button", { name: "Télécharger la quittance (PDF)" }));
    await waitFor(() => { expect(saved[0]?.download).toBe("Quittance-QT-2026-0001.pdf"); });
  });

  it("signale une quittance annulée et masque le téléchargement", async () => {
    stubApi({ [SHOW]: { body: receiptVoidDetail } });

    renderApi(<ReceiptDetailScreen id={REAL_IDS.receipt} />, { pathname: `/loyers/quittances/${REAL_IDS.receipt}` });

    expect(await screen.findByText("Quittance annulée")).toBeTruthy();
    expect(screen.getByText(/annulée le 16\/11\/2026/)).toBeTruthy();
    expect(screen.getByText("Annulée")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Télécharger la quittance/ })).toBeNull();
  });

  it("répond 404 pour une quittance d’autrui ou inconnue", async () => {
    stubApi({ [SHOW]: { status: 404, body: receiptNotFoundProblem } });

    renderApi(<ReceiptDetailScreen id={REAL_IDS.receipt} />, { pathname: "/loyers/quittances/x" });

    expect(await screen.findByRole("heading", { name: "Quittance introuvable" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour à mes quittances" }).getAttribute("href")).toBe("/loyers/quittances");
  });

  it("explique un 403 sans montrer la quittance", async () => {
    stubApi({ [SHOW]: { status: 403, body: problem(403, "space_forbidden", "Accès refusé.") } });

    renderApi(<ReceiptDetailScreen id={REAL_IDS.receipt} />, { pathname: "/loyers/quittances/x" });

    expect(await screen.findByText("Cette quittance n’a pas pu être chargée")).toBeTruthy();
    expect(screen.queryByText("QT-2026-0001")).toBeNull();
  });
});
