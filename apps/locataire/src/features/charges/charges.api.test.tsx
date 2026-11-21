import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHARGE_IDS,
  CURSOR_PAGE_2,
  chargeDetail,
  chargeFile,
  chargeFileNotFoundProblem,
  chargeNotFoundProblem,
  chargePage,
  chargePdfUnavailableProblem,
  chargeSecondFile,
  chargeStatement,
  chargeSuperseded,
  chargeToPay,
  chargeXofDetail,
} from "@/tenant/chargeResponses.fixtures";
import { CHARGES_PATH } from "@/tenant/chargeRequests";
import { LEASE_LOIRE_ID, leasePage, summary } from "@/tenant/responses.fixtures";
import { expectNoA11yViolations } from "../../../test/axe";
import { renderApi, stubApi } from "../../../test/api";
import { DEMO_TEXTS, captureDownloads, choose, nth, problem } from "../rent/testKit";
import { ChargeStatementDetailScreen } from "./ChargeStatementDetailScreen";
import { ChargeStatementsScreen } from "./ChargeStatementsScreen";

const LIST = `GET ${CHARGES_PATH}`;
const SHOW = `GET ${CHARGES_PATH}/${CHARGE_IDS.statement}`;
const PDF = `GET ${CHARGES_PATH}/${CHARGE_IDS.statement}/pdf`;
const PIECE = `GET ${CHARGES_PATH}/${CHARGE_IDS.statement}/files/${CHARGE_IDS.file}`;
const SECOND_PIECE = `GET ${CHARGES_PATH}/${CHARGE_IDS.statement}/files/${CHARGE_IDS.secondFile}`;
const ONE_LEASE = { "GET /api/v1/tenant/leases": { body: leasePage([summary({ id: CHARGE_IDS.lease, reference: "BAIL-2026-001" })]) } };
const TWO_LEASES = {
  "GET /api/v1/tenant/leases": {
    body: leasePage([summary({ id: CHARGE_IDS.lease, reference: "BAIL-2026-001" }), summary({ id: LEASE_LOIRE_ID, reference: "BAIL-LOIRE-07" })]),
  },
};
const DEMO_CHARGES_TEXTS = [...DEMO_TEXTS, "Charges 2025", "Virement •••• 4417", "Gestion Les Tilleuls", "Tantièmes, 64,2 m²", "Inchangée depuis 2023"];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function rows() {
  const table = await screen.findByRole("table", { name: "Mes décomptes de charges" });
  return within(table).getAllByRole("row").slice(1);
}

const region = (name: string) => within(screen.getByRole("region", { name }));

describe("mes décomptes de charges", () => {
  it("liste les décomptes avec numéro, période, solde, état et lien vers le détail", async () => {
    stubApi({ ...ONE_LEASE, [LIST]: { body: chargePage([chargeStatement(), chargeToPay]) } });

    const { container } = renderApi(<ChargeStatementsScreen />, { pathname: "/loyers/regularisation" });

    const found = await rows();
    const credit = nth(found, 0);
    const due = nth(found, 1);
    expect(within(credit).getByRole("link", { name: "DC-2025-0001" }).getAttribute("href")).toBe(`/loyers/regularisation/${CHARGE_IDS.statement}`);
    expect(credit.textContent).toContain("2025");
    expect(credit.textContent).toContain("BAIL-2026-001");
    expect(credit.textContent).toContain("12/03/2026");
    expect(credit.textContent).toContain("À vous rendre 22 €");
    expect(within(credit).getByText("Émis")).toBeTruthy();
    expect(due.textContent).toContain("DC-2024-0003");
    expect(due.textContent).toContain("À payer 145 €");
    expect(screen.queryByRole("combobox", { name: /Bail/ })).toBeNull();
    for (const text of DEMO_CHARGES_TEXTS) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it("signale un décompte remplacé par un rectificatif", async () => {
    stubApi({ ...ONE_LEASE, [LIST]: { body: chargePage([chargeSuperseded]) } });

    renderApi(<ChargeStatementsScreen />, { pathname: "/loyers/regularisation" });

    const row = nth(await rows(), 0);
    expect(within(row).getByText("Remplacé par un rectificatif")).toBeTruthy();
  });

  it("annonce l’absence de décompte", async () => {
    stubApi({ ...ONE_LEASE, [LIST]: { body: chargePage([]) } });

    renderApi(<ChargeStatementsScreen />, { pathname: "/loyers/regularisation" });

    expect(await screen.findByText("Aucun décompte de charges pour l’instant")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    for (const text of DEMO_CHARGES_TEXTS) expect(document.body.textContent).not.toContain(text);
  });

  it("charge la page suivante avec le curseur racine du serveur", async () => {
    const api = stubApi({
      ...ONE_LEASE,
      [LIST]: (call) => ({ body: call.query.cursor === CURSOR_PAGE_2 ? chargePage([chargeToPay]) : chargePage([chargeStatement()], CURSOR_PAGE_2) }),
    });

    const { user } = renderApi(<ChargeStatementsScreen />, { pathname: "/loyers/regularisation" });
    await user.click(await screen.findByRole("button", { name: "Voir plus de décomptes" }));

    await waitFor(() => { expect(api.calls.filter((call) => call.path === CHARGES_PATH).map((call) => call.query.cursor)).toEqual([undefined, CURSOR_PAGE_2]); });
    expect(await screen.findByRole("link", { name: "DC-2024-0003" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "DC-2025-0001" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Voir plus de décomptes" })).toBeNull();
  });

  it("propose le filtre par bail seulement avec plusieurs baux et le transmet au serveur", async () => {
    const api = stubApi({ ...TWO_LEASES, [LIST]: { body: chargePage([chargeStatement()]) } });

    const { user } = renderApi(<ChargeStatementsScreen />, { pathname: "/loyers/regularisation" });
    await rows();
    await choose(user, "Bail", "BAIL-LOIRE-07");

    await waitFor(() => { expect(api.calls.filter((call) => call.path === CHARGES_PATH).map((call) => call.query.lease)).toEqual([undefined, LEASE_LOIRE_ID]); });
  });

  it("reprend le bail demandé dans l’adresse", async () => {
    const api = stubApi({ ...TWO_LEASES, [LIST]: { body: chargePage([]) } });

    renderApi(<ChargeStatementsScreen />, { pathname: "/loyers/regularisation", search: `?bail=${CHARGE_IDS.lease}` });

    expect(await screen.findByText("Aucun décompte n’a été émis pour ce bail.")).toBeTruthy();
    expect(api.calls.find((call) => call.path === CHARGES_PATH)?.query.lease).toBe(CHARGE_IDS.lease);
  });

  it.each([
    [429, "http_429", { "Retry-After": "20" }, /Patientez 20 s/],
    [503, "service_unavailable", {}, /momentanément indisponible/],
    [403, "space_forbidden", {}, /pas ou plus d’accès/],
  ])("explique une erreur %s %s", async (status, code, headers, message) => {
    stubApi({ ...ONE_LEASE, [LIST]: { status, headers, body: problem(status, code, "Erreur.") } });

    renderApi(<ChargeStatementsScreen />, { pathname: "/loyers/regularisation" });

    expect(await screen.findByText("Vos décomptes de charges n’ont pas pu être chargés")).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
  });

  it("signale un serveur injoignable", async () => {
    stubApi({ ...ONE_LEASE });
    const stubbed = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        (input instanceof Request ? input.url : String(input)).includes("/charge-statements") ? Promise.reject(new TypeError("réseau")) : stubbed(input, init),
      ),
    );

    renderApi(<ChargeStatementsScreen />, { pathname: "/loyers/regularisation" });

    expect(await screen.findByText("Vos décomptes de charges n’ont pas pu être chargés")).toBeTruthy();
    expect(screen.getByText(/injoignable/)).toBeTruthy();
  });

  it("refuse une réponse mal formée au lieu d’afficher des montants faux", async () => {
    stubApi({ ...ONE_LEASE, [LIST]: { body: chargePage([chargeStatement({ balance: { amount: "22,00", currency: "EUR" } })]) } });

    renderApi(<ChargeStatementsScreen />, { pathname: "/loyers/regularisation" });

    expect(await screen.findByText("Vos décomptes de charges n’ont pas pu être chargés")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("détail d’un décompte de charges", () => {
  it("montre les lignes, les totaux, le règlement, la provision suggérée et les pièces", async () => {
    stubApi({ [SHOW]: { body: chargeDetail({ files: [chargeFile, chargeSecondFile] }) } });

    const { container } = renderApi(<ChargeStatementDetailScreen id={CHARGE_IDS.statement} />, { pathname: `/loyers/regularisation/${CHARGE_IDS.statement}` });

    expect(await screen.findByRole("heading", { level: 1, name: "Régularisation des charges 2025" })).toBeTruthy();
    expect(screen.getByText("Décompte DC-2025-0001 · émis le 12/03/2026")).toBeTruthy();
    expect(screen.getByText("Émis")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Régularisation des charges" }).getAttribute("href")).toBe("/loyers/regularisation");

    const table = within(screen.getByRole("table", { name: "Détail des charges" }));
    const heating = within(table.getByRole("row", { name: /Chauffage collectif/ }));
    expect(heating.getByText("Tantièmes 64/1 000")).toBeTruthy();
    expect(heating.getByText("6 289,07 €")).toBeTruthy();
    expect(heating.getByText("365")).toBeTruthy();
    expect(heating.getByText("402,50 €")).toBeTruthy();
    expect(within(table.getByRole("row", { name: /Total de votre part/ })).getByText("938 €")).toBeTruthy();

    const calculation = region("Calcul du solde");
    expect(calculation.getByText("Votre part des charges").nextElementSibling?.textContent).toBe("938 €");
    expect(calculation.getByText("Provisions appelées").nextElementSibling?.textContent).toBe("− 960 €");
    expect(calculation.getByText("Solde à vous rendre").nextElementSibling?.textContent).toBe("22 €");
    expect(screen.getByText("78,17 € par mois")).toBeTruthy();
    expect(screen.getByText("365 jours d’occupation")).toBeTruthy();

    expect(region("Règlement du solde").getByText("Le crédit sera repris à votre prochain avis d’échéance.")).toBeTruthy();
    const pieces = region("Pièces justificatives");
    expect(pieces.getByText("Eau et chauffage 2025")).toBeTruthy();
    expect(pieces.getByText("Disponible jusqu’au 12/09/2026")).toBeTruthy();
    expect(pieces.getByText("Facture ascenseur")).toBeTruthy();
    expect(pieces.getAllByText(/Disponible jusqu’au/)).toHaveLength(1);
    for (const text of DEMO_CHARGES_TEXTS) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it("annonce un solde à payer et la date à partir de laquelle il sera appelé", async () => {
    stubApi({ [SHOW]: { body: { data: { ...chargeToPay, id: CHARGE_IDS.statement, lines: [] } } } });

    renderApi(<ChargeStatementDetailScreen id={CHARGE_IDS.statement} />, { pathname: "/x" });

    expect(await screen.findByRole("heading", { level: 1, name: "Régularisation des charges 2024" })).toBeTruthy();
    const calculation = region("Calcul du solde");
    expect(calculation.getByText("Solde à payer").nextElementSibling?.textContent).toBe("145 €");
    expect(calculation.queryByText("Solde à vous rendre")).toBeNull();
    expect(region("Règlement du solde").getByText("Le solde sera ajouté à vos prochains avis d’échéance à partir du 12/04/2025.")).toBeTruthy();
  });

  it.each([
    ["plan_12", /étalé sur 12 mois/],
    ["standalone_installment", /avis d’échéance distinct/],
    ["none", /Aucun règlement/],
  ])("traduit le règlement %s", async (settlement, text) => {
    stubApi({ [SHOW]: { body: chargeDetail({ settlement }) } });

    renderApi(<ChargeStatementDetailScreen id={CHARGE_IDS.statement} />, { pathname: "/x" });

    expect(await screen.findByText(text)).toBeTruthy();
  });

  it("n’affiche pas de règlement quand le serveur n’en annonce pas", async () => {
    stubApi({ [SHOW]: { body: chargeDetail({ settlement: null }) } });

    renderApi(<ChargeStatementDetailScreen id={CHARGE_IDS.statement} />, { pathname: "/x" });

    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("region", { name: "Règlement du solde" })).toBeNull();
  });

  it("signale un décompte remplacé par un rectificatif", async () => {
    stubApi({ [SHOW]: { body: chargeDetail({ status: "superseded" }) } });

    renderApi(<ChargeStatementDetailScreen id={CHARGE_IDS.statement} />, { pathname: "/x" });

    expect(await screen.findByText("Décompte remplacé")).toBeTruthy();
    expect(screen.getByText(/remplacé par un rectificatif/, { selector: "div" })).toBeTruthy();
    expect(screen.getAllByText("Remplacé par un rectificatif").length).toBeGreaterThan(0);
  });

  it("respecte la devise XOF : aucun décimal, aucun euro", async () => {
    stubApi({ [SHOW]: { body: chargeXofDetail } });

    renderApi(<ChargeStatementDetailScreen id={CHARGE_IDS.statement} />, { pathname: "/x" });

    await screen.findByRole("heading", { level: 1 });
    const calculation = region("Calcul du solde");
    expect(calculation.getByText("Solde à payer").nextElementSibling?.textContent).toMatch(/^50\s000\sF\sCFA$/);
    expect(calculation.getByText("Provisions appelées").nextElementSibling?.textContent).toMatch(/^−\s400\s000\sF\sCFA$/);
    expect(document.body.textContent).not.toContain("€");
    expect(document.body.textContent).not.toMatch(/\d,\d\d\sF/);
  });

  it("télécharge le PDF par le client authentifié", async () => {
    const saved = captureDownloads();
    const api = stubApi({ [SHOW]: { body: chargeDetail() }, [PDF]: { pdf: "%PDF-1.4 décompte" } });

    const { user } = renderApi(<ChargeStatementDetailScreen id={CHARGE_IDS.statement} />, { pathname: "/x" });
    await user.click(await screen.findByRole("button", { name: "Télécharger le décompte (PDF)" }));

    await waitFor(() => { expect(saved).toHaveLength(1); });
    expect(saved[0]?.download).toBe("Decompte-charges-DC-2025-0001.pdf");
    expect(api.calls.find((call) => call.path.endsWith("/pdf"))?.headers.accept).toBe("application/pdf");
  });

  it("télécharge une pièce partagée sans ouvrir d’adresse externe", async () => {
    const saved = captureDownloads();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const api = stubApi({
      [SHOW]: { body: chargeDetail({ files: [chargeFile, chargeSecondFile] }) },
      [PIECE]: { pdf: "%PDF-1.4 pièce" },
      [SECOND_PIECE]: { body: "image", headers: { "Content-Type": "image/jpeg" } },
    });

    const { user } = renderApi(<ChargeStatementDetailScreen id={CHARGE_IDS.statement} />, { pathname: "/x" });
    await user.click(await screen.findByRole("button", { name: "Télécharger la pièce Eau et chauffage 2025" }));
    await waitFor(() => { expect(saved).toHaveLength(1); });
    await user.click(screen.getByRole("button", { name: "Télécharger la pièce Facture ascenseur" }));

    await waitFor(() => { expect(saved).toHaveLength(2); });
    expect(saved.map((file) => file.download)).toEqual(["DC-2025-0001-Eau-et-chauffage-2025.pdf", "DC-2025-0001-Facture-ascenseur.jpg"]);
    expect(api.calls.filter((call) => call.path.includes("/files/"))).toHaveLength(2);
    expect(open).not.toHaveBeenCalled();
  });

  it("invite à écrire à l’agence quand aucune pièce n’est partagée", async () => {
    stubApi({ [SHOW]: { body: chargeDetail() } });

    renderApi(<ChargeStatementDetailScreen id={CHARGE_IDS.statement} />, { pathname: "/x" });

    const pieces = await screen.findByRole("region", { name: "Pièces justificatives" });
    expect(within(pieces).getByText(/Aucune pièce n’est mise à disposition/)).toBeTruthy();
    expect(within(pieces).getByRole("link", { name: "Écrire à mon agence" }).getAttribute("href")).toBe("/messages/nouveau");
    expect(within(pieces).queryByRole("button")).toBeNull();
  });

  it("répond 404 pour un décompte d’autrui ou inconnu", async () => {
    stubApi({ [SHOW]: { status: 404, body: chargeNotFoundProblem } });

    renderApi(<ChargeStatementDetailScreen id={CHARGE_IDS.statement} />, { pathname: "/x" });

    expect(await screen.findByRole("heading", { name: "Décompte introuvable" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour à mes décomptes de charges" }).getAttribute("href")).toBe("/loyers/regularisation");
  });

  it.each([
    [429, "http_429", { "Retry-After": "20" }, /Patientez 20 s/],
    [503, "service_unavailable", {}, /momentanément indisponible/],
  ])("explique une erreur %s du détail", async (status, code, headers, message) => {
    stubApi({ [SHOW]: { status, headers, body: problem(status, code, "Erreur.") } });

    renderApi(<ChargeStatementDetailScreen id={CHARGE_IDS.statement} />, { pathname: "/x" });

    expect(await screen.findByText("Ce décompte n’a pas pu être chargé")).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByText("DC-2025-0001")).toBeNull();
  });

  it("explique l’échec du PDF (503) sans rien enregistrer", async () => {
    const saved = captureDownloads();
    stubApi({ [SHOW]: { body: chargeDetail() }, [PDF]: { status: 503, headers: { "Retry-After": "30" }, body: chargePdfUnavailableProblem } });

    const { user } = renderApi(<ChargeStatementDetailScreen id={CHARGE_IDS.statement} />, { pathname: "/x" });
    await user.click(await screen.findByRole("button", { name: "Télécharger le décompte (PDF)" }));

    expect(await screen.findByText("Le téléchargement a échoué")).toBeTruthy();
    expect(screen.getByText("Le PDF du décompte est momentanément indisponible. Réessayez dans un instant.")).toBeTruthy();
    expect(saved).toHaveLength(0);
  });

  it("explique une pièce qui n’est plus partagée (404)", async () => {
    const saved = captureDownloads();
    stubApi({ [SHOW]: { body: chargeDetail({ files: [chargeFile] }) }, [PIECE]: { status: 404, body: chargeFileNotFoundProblem } });

    const { user } = renderApi(<ChargeStatementDetailScreen id={CHARGE_IDS.statement} />, { pathname: "/x" });
    await user.click(await screen.findByRole("button", { name: "Télécharger la pièce Eau et chauffage 2025" }));

    expect(await screen.findByText(/n’est plus mise à disposition/)).toBeTruthy();
    expect(saved).toHaveLength(0);
  });

  it("explique la limite de débit du PDF avec l’attente annoncée", async () => {
    stubApi({ [SHOW]: { body: chargeDetail() }, [PDF]: { status: 429, headers: { "Retry-After": "12" }, body: problem(429, "http_429", "Trop.") } });

    const { user } = renderApi(<ChargeStatementDetailScreen id={CHARGE_IDS.statement} />, { pathname: "/x" });
    await user.click(await screen.findByRole("button", { name: "Télécharger le décompte (PDF)" }));

    expect(await screen.findByText(/Patientez 12 s/)).toBeTruthy();
  });

  it("refuse une pièce servie sous un type exécutable", async () => {
    const saved = captureDownloads();
    stubApi({
      [SHOW]: { body: chargeDetail({ files: [chargeFile] }) },
      [PIECE]: { body: "<script>", headers: { "Content-Type": "text/html" } },
    });

    const { user } = renderApi(<ChargeStatementDetailScreen id={CHARGE_IDS.statement} />, { pathname: "/x" });
    await user.click(await screen.findByRole("button", { name: "Télécharger la pièce Eau et chauffage 2025" }));

    expect(await screen.findByText("Le téléchargement a échoué")).toBeTruthy();
    expect(saved).toHaveLength(0);
  });
});
