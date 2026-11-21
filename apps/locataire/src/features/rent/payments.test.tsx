import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REAL_IDS, installmentNotFoundProblem, paymentPartialDetail, paymentsAll, paymentsEmpty, paymentsPage1, paymentsWithCancelled } from "@/tenant/rentResponses.fixtures";
import { expectNoA11yViolations } from "../../../test/axe";
import { renderApi, stubApi } from "../../../test/api";
import { PaymentDetailScreen } from "./PaymentDetailScreen";
import { PaymentsScreen } from "./PaymentsScreen";
import { DEMO_TEXTS, LEASES_STUB, RENT, choose, clone, nth, problem } from "./testKit";

const LIST = `GET ${RENT}/payments`;
const SHOW = `GET ${RENT}/payments/${REAL_IDS.payment1}`;

afterEach(() => {
  vi.unstubAllGlobals();
});

async function rows() {
  const table = await screen.findByRole("table", { name: "Mes paiements" });
  return within(table).getAllByRole("row").slice(1);
}

describe("mes paiements", () => {
  it("liste les paiements avec montant, mode, bail et statut, annulés compris", async () => {
    stubApi({ ...LEASES_STUB, [LIST]: { body: paymentsWithCancelled } });

    const { container } = renderApi(<PaymentsScreen />, { pathname: "/loyers/paiements" });

    const all = await rows();
    const cancelled = nth(all, 0);
    const recorded = nth(all, 1);
    expect(cancelled.textContent).toContain("350 €");
    expect(within(cancelled).getByText("Annulé")).toBeTruthy();
    expect(recorded.textContent).toContain("300 €");
    expect(recorded.textContent).toContain("Virement");
    expect(recorded.textContent).toContain("BL-2026-99809");
    expect(within(recorded).getByText("Enregistré")).toBeTruthy();
    expect(within(recorded).getByRole("link", { name: "16/11/2026" }).getAttribute("href")).toBe(`/loyers/paiements/${REAL_IDS.payment1}`);
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it("annonce l’absence de paiement", async () => {
    stubApi({ ...LEASES_STUB, [LIST]: { body: paymentsEmpty } });

    renderApi(<PaymentsScreen />, { pathname: "/loyers/paiements" });

    expect(await screen.findByText("Aucun paiement pour le moment")).toBeTruthy();
  });

  it("filtre par bail côté serveur et ouvre sur le bail demandé", async () => {
    const api = stubApi({ ...LEASES_STUB, [LIST]: { body: paymentsAll } });

    const { user } = renderApi(<PaymentsScreen />, { pathname: "/loyers/paiements" });
    await rows();
    await choose(user, "Bail", "BL-2026-99809");

    await waitFor(() => {
      expect(api.calls.filter((call) => call.path === `${RENT}/payments`).map((call) => call.query.lease)).toEqual([undefined, REAL_IDS.lease]);
    });
  });

  it("charge la page suivante avec le curseur du serveur", async () => {
    const api = stubApi({
      ...LEASES_STUB,
      [LIST]: (call) => ({ body: call.query.cursor === undefined ? paymentsPage1 : { ...clone(paymentsAll), data: [nth(paymentsAll.data, 1)] } }),
    });

    const { user } = renderApi(<PaymentsScreen />, { pathname: "/loyers/paiements" });
    await user.click(await screen.findByRole("button", { name: "Afficher plus de paiements" }));

    await waitFor(() => { expect(api.calls.filter((call) => call.path === `${RENT}/payments`).map((call) => call.query.cursor)).toEqual([undefined, paymentsPage1.meta.next_cursor]); });
    expect(await rows()).toHaveLength(2);
  });

  it.each([
    [403, "space_forbidden", /pas ou plus d’accès/],
    [429, "http_429", /Trop de demandes/],
  ])("explique une erreur %s", async (status, code, message) => {
    stubApi({ ...LEASES_STUB, [LIST]: { status, body: problem(status, code, "Erreur.") } });

    renderApi(<PaymentsScreen />, { pathname: "/loyers/paiements" });

    expect(await screen.findByText("Vos paiements n’ont pas pu être chargés")).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
  });
});

describe("détail d’un paiement", () => {
  it("montre le montant, le mode, la date et la répartition sur l’échéance", async () => {
    stubApi({ [SHOW]: { body: paymentPartialDetail } });

    const { container } = renderApi(<PaymentDetailScreen id={REAL_IDS.payment1} />, { pathname: `/loyers/paiements/${REAL_IDS.payment1}` });

    expect(await screen.findByRole("heading", { level: 1, name: "Paiement du 16/11/2026" })).toBeTruthy();
    expect(screen.getByText("Enregistré", { selector: "span" })).toBeTruthy();
    expect(screen.getAllByText("300 €").length).toBeGreaterThan(0);
    expect(screen.getByText("Virement")).toBeTruthy();
    const split = screen.getByRole("region", { name: "Répartition sur vos échéances" });
    expect(within(split).getByRole("link", { name: "Échéance de loyer" }).getAttribute("href")).toBe(`/loyers/echeances/${REAL_IDS.installment}`);
    expect(split.textContent).toContain("300 €");
    expect(screen.getByRole("link", { name: "Voir les loyers du bail" }).getAttribute("href")).toBe(`/loyers?bail=${REAL_IDS.lease}`);
    expect(screen.queryByText("Paiement annulé")).toBeNull();
    await expectNoA11yViolations(container);
  });

  it("signale un paiement annulé sans répartition", async () => {
    const body = clone(paymentPartialDetail);
    Object.assign(body.data, { status: "cancelled", cancelled_on: "2026-11-16", allocations: [] });
    stubApi({ [SHOW]: { body } });

    renderApi(<PaymentDetailScreen id={REAL_IDS.payment1} />, { pathname: "/loyers/paiements/x" });

    expect(await screen.findByText("Paiement annulé")).toBeTruthy();
    expect(screen.getByText("Ce paiement annulé n’est plus réparti.")).toBeTruthy();
  });

  it("explique un paiement non réparti (avance)", async () => {
    const body = clone(paymentPartialDetail);
    Object.assign(body.data, { allocations: [] });
    stubApi({ [SHOW]: { body } });

    renderApi(<PaymentDetailScreen id={REAL_IDS.payment1} />, { pathname: "/loyers/paiements/x" });

    expect(await screen.findByText("Ce paiement n’est réparti sur aucune échéance pour le moment.")).toBeTruthy();
  });

  it("répond 404 pour un paiement d’autrui ou inconnu", async () => {
    stubApi({ [SHOW]: { status: 404, body: installmentNotFoundProblem } });

    renderApi(<PaymentDetailScreen id={REAL_IDS.payment1} />, { pathname: "/loyers/paiements/x" });

    expect(await screen.findByRole("heading", { name: "Paiement introuvable" })).toBeTruthy();
  });
});
