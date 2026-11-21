import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  REAL_IDS,
  installmentAfterCancel,
  installmentIssuedDetail,
  installmentNotFoundProblem,
  installmentPaidDetail,
  installmentPartialDetail,
  installmentsAll,
  installmentsIssuedPage1,
  installmentsPaidList,
  installmentsPartial,
} from "@/tenant/rentResponses.fixtures";
import { expectNoA11yViolations } from "../../../test/axe";
import { renderApi, stubApi } from "../../../test/api";
import { InstallmentDetailScreen } from "./InstallmentDetailScreen";
import { InstallmentsScreen } from "./InstallmentsScreen";
import { DEMO_TEXTS, LEASES_STUB, RENT, captureDownloads, choose, clone, nth, problem } from "./testKit";

const LIST = `GET ${RENT}/installments`;
const NOTICE = `GET ${RENT}/installments/${REAL_IDS.installment}/notice/download`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function rows() {
  const table = await screen.findByRole("table", { name: "Mes échéances de loyer" });
  return within(table).getAllByRole("row").slice(1);
}

describe("mes loyers", () => {
  it("liste les échéances réelles avec reste dû, statut, retard et avis", async () => {
    stubApi({ ...LEASES_STUB, [LIST]: { body: installmentsAll } });

    const { container } = renderApi(<InstallmentsScreen />, { pathname: "/loyers" });

    const all = await rows();
    const december = nth(all, 0);
    const november = nth(all, 1);
    expect(within(november).getByRole("link", { name: "Novembre 2026" }).getAttribute("href")).toBe(`/loyers/echeances/${REAL_IDS.installment}`);
    expect(november.textContent).toContain("À payer avant le 05/11/2026");
    expect(november.textContent).toContain("BL-2026-99809");
    expect(november.textContent).toContain("650 €");
    expect(within(november).getByText("Émis")).toBeTruthy();
    expect(within(november).getByText("En retard")).toBeTruthy();
    expect(within(november).getByRole("button", { name: "Télécharger l’avis d’échéance Novembre 2026" })).toBeTruthy();
    expect(within(december).getByRole("link", { name: "Décembre 2026" })).toBeTruthy();
    expect(within(december).queryByText("En retard")).toBeNull();
    expect(within(december).queryByRole("button", { name: /avis/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Mes quittances" }).getAttribute("href")).toBe("/loyers/quittances");
    expect(screen.getByRole("link", { name: "Mes paiements" }).getAttribute("href")).toBe("/loyers/paiements");
    for (const text of DEMO_TEXTS) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it("montre un loyer partiellement payé avec son reste dû", async () => {
    stubApi({ ...LEASES_STUB, [LIST]: { body: installmentsPartial } });

    renderApi(<InstallmentsScreen />, { pathname: "/loyers" });

    const row = nth(await rows(), 0);
    expect(row.textContent).toContain("Partiellement payé");
    expect(row.textContent).toContain("350 €");
    expect(row.textContent).toContain("650 €");
  });

  it("renvoie vers la quittance d’un loyer payé", async () => {
    stubApi({ ...LEASES_STUB, [LIST]: { body: installmentsPaidList } });

    renderApi(<InstallmentsScreen />, { pathname: "/loyers" });

    const row = nth(await rows(), 0);
    expect(within(row).getByText("Payé")).toBeTruthy();
    expect(within(row).getByRole("link", { name: "Voir la quittance QT-2026-0001" }).getAttribute("href")).toBe(`/loyers/quittances/${REAL_IDS.receipt}`);
  });

  it("télécharge l’avis par le client authentifié, sans lien public", async () => {
    const saved = captureDownloads();
    const api = stubApi({ ...LEASES_STUB, [LIST]: { body: installmentsAll }, [NOTICE]: { pdf: "%PDF-1.4 avis" } });

    const { user } = renderApi(<InstallmentsScreen />, { pathname: "/loyers" });
    await user.click(await screen.findByRole("button", { name: "Télécharger l’avis d’échéance Novembre 2026" }));

    await waitFor(() => { expect(saved).toHaveLength(1); });
    expect(saved[0]?.download).toBe("Avis-echeance-AV-2026-0001.pdf");
    expect(saved[0]?.href).toBe("blob:demo");
    const call = api.calls.find((entry) => entry.path.endsWith("/notice/download"));
    expect(call?.headers.accept).toBe("application/pdf");
    expect(document.querySelector("a[href*='download']")).toBeNull();
  });

  it("explique un avis devenu introuvable sans casser la liste", async () => {
    captureDownloads();
    stubApi({
      ...LEASES_STUB,
      [LIST]: { body: installmentsAll },
      [NOTICE]: { status: 404, body: problem(404, "rent_notice_not_found", "Avis introuvable.") },
    });

    const { user } = renderApi(<InstallmentsScreen />, { pathname: "/loyers" });
    await user.click(await screen.findByRole("button", { name: "Télécharger l’avis d’échéance Novembre 2026" }));

    expect(await screen.findByText("Le téléchargement a échoué")).toBeTruthy();
    expect(screen.getByText("Ce document n’est plus disponible.")).toBeTruthy();
    expect(screen.getByRole("table", { name: "Mes échéances de loyer" })).toBeTruthy();
  });

  it("filtre par statut côté serveur", async () => {
    const api = stubApi({
      ...LEASES_STUB,
      [LIST]: (call) => ({ body: call.query.status === "paid" ? installmentsPaidList : installmentsAll }),
    });

    const { user } = renderApi(<InstallmentsScreen />, { pathname: "/loyers" });
    await screen.findByRole("table", { name: "Mes échéances de loyer" });
    await choose(user, "Statut", "Payé");

    expect(await screen.findByRole("link", { name: "Voir la quittance QT-2026-0001" })).toBeTruthy();
    const statuses = api.calls.filter((call) => call.path === `${RENT}/installments`).map((call) => call.query.status);
    expect(statuses).toEqual([undefined, "paid"]);
    expect((await rows())).toHaveLength(1);
  });

  it("filtre par bail côté serveur", async () => {
    const api = stubApi({ ...LEASES_STUB, [LIST]: { body: installmentsAll } });

    const { user } = renderApi(<InstallmentsScreen />, { pathname: "/loyers" });
    await screen.findByRole("table", { name: "Mes échéances de loyer" });
    await choose(user, "Bail", "BL-2026-99809");

    await waitFor(() => {
      expect(api.calls.filter((call) => call.path === `${RENT}/installments`).map((call) => call.query.lease)).toEqual([undefined, REAL_IDS.lease]);
    });
  });

  it("ouvre sur le bail demandé par le détail du bail", async () => {
    const api = stubApi({ ...LEASES_STUB, [LIST]: { body: installmentsAll } });

    renderApi(<InstallmentsScreen />, { pathname: "/loyers", search: `?bail=${REAL_IDS.lease}` });

    await screen.findByRole("table", { name: "Mes échéances de loyer" });
    expect(api.calls.find((call) => call.path === `${RENT}/installments`)?.query.lease).toBe(REAL_IDS.lease);
  });

  it("ignore un paramètre bail qui n’est pas un identifiant", async () => {
    const api = stubApi({ ...LEASES_STUB, [LIST]: { body: installmentsAll } });

    renderApi(<InstallmentsScreen />, { pathname: "/loyers", search: "?bail=<script>" });

    await screen.findByRole("table", { name: "Mes échéances de loyer" });
    expect(api.calls.find((call) => call.path === `${RENT}/installments`)?.query.lease).toBeUndefined();
  });

  it("annonce l’absence d’avis, puis l’absence de résultat d’un filtre", async () => {
    const empty = { ...clone(installmentsAll), data: [] };
    stubApi({ ...LEASES_STUB, [LIST]: { body: empty } });

    const { user } = renderApi(<InstallmentsScreen />, { pathname: "/loyers" });

    expect(await screen.findByText("Aucun avis pour le moment")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    await choose(user, "Statut", "Payé");
    expect(await screen.findByText("Aucune échéance ne correspond à ces filtres")).toBeTruthy();
  });

  it("charge la page suivante avec le curseur du serveur", async () => {
    const api = stubApi({
      ...LEASES_STUB,
      [LIST]: (call) => ({ body: call.query.cursor === undefined ? installmentsIssuedPage1 : { ...clone(installmentsAll), data: [nth(installmentsAll.data, 1)] } }),
    });

    const { user } = renderApi(<InstallmentsScreen />, { pathname: "/loyers" });
    await screen.findByRole("link", { name: "Décembre 2026" });
    await user.click(screen.getByRole("button", { name: "Afficher plus d’échéances" }));

    expect(await screen.findByRole("link", { name: "Novembre 2026" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Décembre 2026" })).toBeTruthy();
    expect(api.calls.filter((call) => call.path === `${RENT}/installments`).map((call) => call.query.cursor)).toEqual([undefined, installmentsIssuedPage1.meta.next_cursor]);
    expect(screen.queryByRole("button", { name: "Afficher plus d’échéances" })).toBeNull();
  });

  it("garde les échéances chargées quand la page suivante échoue", async () => {
    stubApi({
      ...LEASES_STUB,
      [LIST]: (call) =>
        call.query.cursor === undefined ? { body: installmentsIssuedPage1 } : { status: 429, headers: { "Retry-After": "20" }, body: problem(429, "http_429", "Too Many Attempts.") },
    });

    const { user } = renderApi(<InstallmentsScreen />, { pathname: "/loyers" });
    await user.click(await screen.findByRole("button", { name: "Afficher plus d’échéances" }));

    expect(await screen.findByText("Les échéances suivantes n’ont pas pu être chargées")).toBeTruthy();
    expect(screen.getByText(/Patientez 20 s/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Décembre 2026" })).toBeTruthy();
  });

  it.each([
    [403, "space_forbidden", /pas ou plus d’accès à l’espace locataire/, false],
    [403, "email_unverified", /Confirmez votre adresse e-mail/, false],
    [429, "http_429", /Trop de demandes/, true],
    [500, "server_error", /Erreur interne/, true],
  ])("explique une erreur %s %s", async (status, code, message, retry) => {
    stubApi({ ...LEASES_STUB, [LIST]: { status, body: problem(status, code, "Erreur interne.") } });

    renderApi(<InstallmentsScreen />, { pathname: "/loyers" });

    expect(await screen.findByText("Vos loyers n’ont pas pu être chargés")).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Réessayer" }) !== null).toBe(retry);
    expect(screen.getByRole("combobox", { name: /Statut/ })).toBeTruthy();
  });

  it("renvoie vers la connexion quand la session expire", async () => {
    stubApi({ ...LEASES_STUB, [LIST]: { status: 401, body: problem(401, "unauthenticated", "Non authentifié.") } });

    renderApi(<InstallmentsScreen />, { pathname: "/loyers" });

    expect(await screen.findByRole("link", { name: "Se connecter" })).toBeTruthy();
  });

  it("signale un serveur injoignable", async () => {
    stubApi({ ...LEASES_STUB });
    const stubbed = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        (input instanceof Request ? input.url : String(input)).includes("/installments") ? Promise.reject(new TypeError("réseau")) : stubbed(input, init),
      ),
    );

    renderApi(<InstallmentsScreen />, { pathname: "/loyers" });

    expect(await screen.findByText("Vos loyers n’ont pas pu être chargés")).toBeTruthy();
    expect(screen.getByText(/injoignable/)).toBeTruthy();
  });

  it("refuse une réponse mal formée au lieu d’afficher des montants faux", async () => {
    const broken = clone(installmentsAll);
    Object.assign(broken.data[0] ?? {}, { amounts: { total: { amount: "650,50", currency: "EUR" } } });
    stubApi({ ...LEASES_STUB, [LIST]: { body: broken } });

    renderApi(<InstallmentsScreen />, { pathname: "/loyers" });

    expect(await screen.findByText("Vos loyers n’ont pas pu être chargés")).toBeTruthy();
    expect(screen.getByText(/répondu de façon inattendue/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("détail d’une échéance", () => {
  const SHOW = `GET ${RENT}/installments/${REAL_IDS.installment}`;

  it("montre les montants, les lignes, l’avis et les liens croisés", async () => {
    const saved = captureDownloads();
    stubApi({ [SHOW]: { body: installmentIssuedDetail }, [NOTICE]: { pdf: "%PDF" } });

    const { container, user } = renderApi(<InstallmentDetailScreen id={REAL_IDS.installment} />, { pathname: `/loyers/echeances/${REAL_IDS.installment}` });

    expect(await screen.findByRole("heading", { level: 1, name: "Loyer Novembre 2026" })).toBeTruthy();
    expect(screen.getByText("Émis")).toBeTruthy();
    expect(screen.getByText("En retard")).toBeTruthy();
    expect(screen.getByText(/Bail BL-2026-99809 · du 01\/11\/2026 au 30\/11\/2026/)).toBeTruthy();
    const lines = screen.getByRole("table", { name: "Lignes de l’échéance" });
    expect(within(lines).getByText("Loyer de novembre 2026")).toBeTruthy();
    expect(within(lines).getByText(/\(30\/30 j\)/)).toBeTruthy();
    expect(screen.getByText("AV-2026-0001, émis le 16/11/2026")).toBeTruthy();
    expect(screen.getByText("Émise quand l’échéance est soldée")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir le bail" }).getAttribute("href")).toBe(`/bail/${REAL_IDS.lease}`);
    expect(screen.getByRole("link", { name: "Voir les paiements de ce bail" }).getAttribute("href")).toBe(`/loyers/paiements?bail=${REAL_IDS.lease}`);
    await expectNoA11yViolations(container);
    await user.click(screen.getByRole("button", { name: "Télécharger l’avis (PDF)" }));
    await waitFor(() => { expect(saved[0]?.download).toBe("Avis-echeance-AV-2026-0001.pdf"); });
  });

  it("montre un reste dû partiel après un paiement", async () => {
    stubApi({ [SHOW]: { body: installmentPartialDetail } });

    renderApi(<InstallmentDetailScreen id={REAL_IDS.installment} />, { pathname: "/loyers/echeances/x" });

    expect(await screen.findByText("Partiellement payé")).toBeTruthy();
    const stat = screen.getByText("Reste dû").closest("div");
    expect(stat?.textContent).toContain("350 €");
  });

  it("renvoie vers la quittance d’une échéance soldée", async () => {
    stubApi({ [SHOW]: { body: installmentPaidDetail } });

    renderApi(<InstallmentDetailScreen id={REAL_IDS.installment} />, { pathname: "/loyers/echeances/x" });

    const link = await screen.findByRole("link", { name: /QT-2026-0001, émise le 16\/11\/2026/ });
    expect(link.getAttribute("href")).toBe(`/loyers/quittances/${REAL_IDS.receipt}`);
    expect(screen.queryByText("En retard")).toBeNull();
  });

  it("revient à partiellement payé quand le paiement soldant est annulé", async () => {
    stubApi({ [SHOW]: { body: installmentAfterCancel } });

    renderApi(<InstallmentDetailScreen id={REAL_IDS.installment} />, { pathname: "/loyers/echeances/x" });

    expect(await screen.findByText("Partiellement payé")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /QT-2026/ })).toBeNull();
  });

  it("masque le téléchargement quand l’avis n’existe pas", async () => {
    const body = clone(installmentIssuedDetail);
    Object.assign(body.data, { notice: null });
    stubApi({ [SHOW]: { body } });

    renderApi(<InstallmentDetailScreen id={REAL_IDS.installment} />, { pathname: "/loyers/echeances/x" });

    expect(await screen.findByText("Pas encore disponible")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Télécharger l’avis/ })).toBeNull();
  });

  it("répond 404 sans montrer d’autre donnée", async () => {
    stubApi({ [SHOW]: { status: 404, body: installmentNotFoundProblem } });

    renderApi(<InstallmentDetailScreen id={REAL_IDS.installment} />, { pathname: "/loyers/echeances/x" });

    expect(await screen.findByRole("heading", { name: "Échéance introuvable" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour à mes loyers" }).getAttribute("href")).toBe("/loyers");
  });

  it.each([
    [403, "space_forbidden", /pas ou plus d’accès/],
    [429, "http_429", /Trop de demandes/],
  ])("explique une erreur %s", async (status, code, message) => {
    stubApi({ [SHOW]: { status, body: problem(status, code, "Erreur.") } });

    renderApi(<InstallmentDetailScreen id={REAL_IDS.installment} />, { pathname: "/loyers/echeances/x" });

    expect(await screen.findByText("Cette échéance n’a pas pu être chargée")).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
  });
});
