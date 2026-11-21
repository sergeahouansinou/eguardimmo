import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApi, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { captureDownloads } from "../../../test/download";
import { setLocation } from "../../../test/navigation";
import { problem } from "../responses.fixtures";
import { one, page } from "../shared/fixtures";
import { FILE_ID, INTERVENTION, INTERVENTION_DETAIL, INTERVENTION_ID, SECOND_INTERVENTION } from "./fixtures";
import { InterventionScreen } from "./InterventionScreen";
import { InterventionsScreen } from "./InterventionsScreen";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const LIST = "GET /api/v1/owner/interventions";
const DETAIL = `GET /api/v1/owner/interventions/${INTERVENTION_ID}`;

beforeEach(() => {
  setLocation("/confie/interventions");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("liste des interventions en mode api", () => {
  it("affiche les interventions sans identité du locataire", async () => {
    stubApi({ [LIST]: { body: page([INTERVENTION, SECOND_INTERVENTION]) } });
    const { container } = renderApi(<InterventionsScreen />);

    const table = await screen.findByRole("table", { name: "Interventions sur vos lots" });
    expect(within(table).getByRole("link", { name: "INT-2026-0031 · Fuite sous l’évier" }).getAttribute("href")).toBe(`/confie/interventions/${INTERVENTION_ID}`);
    expect(within(table).getByText("En attente d’accord")).toBeTruthy();
    expect(within(table).getByText("Clôturée")).toBeTruthy();
    expect(within(table).getByText("Urgente")).toBeTruthy();
    expect(within(table).getByText("Résidence Les Filaos · lot A1")).toBeTruthy();
    expect(within(table).getByText("Résidence Les Filaos · parties communes")).toBeTruthy();
    expect(within(table).getByText("Pas encore désigné")).toBeTruthy();
    expect(within(table).getByText("120 €")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("affiche un état vide", async () => {
    stubApi({ [LIST]: { body: page([]) } });
    renderApi(<InterventionsScreen />);

    expect(await screen.findByText("Aucune intervention")).toBeTruthy();
  });

  it("signale un compte sans accès", async () => {
    stubApi({ [LIST]: problem(403, "space_forbidden") });
    renderApi(<InterventionsScreen />);

    expect(await screen.findByText("Vos interventions n’ont pas pu être chargées")).toBeTruthy();
  });
});

describe("intervention en lecture seule en mode api", () => {
  it("affiche visites, historique, fichiers, devis soumis, accords, factures et imputations", async () => {
    stubApi({ [DETAIL]: { body: one(INTERVENTION_DETAIL) } });
    const { container } = renderApi(<InterventionScreen id={INTERVENTION_ID} />);

    expect(await screen.findByRole("heading", { level: 1, name: "INT-2026-0031 · Fuite sous l’évier" })).toBeTruthy();
    expect(screen.getByText("Un devis attend une décision")).toBeTruthy();
    const summary = screen.getByRole("region", { name: "Résumé" });
    expect(within(summary).getByText("À votre charge")).toBeTruthy();
    expect(within(summary).getByText("Fuite constatée par l’agence lors de la visite.")).toBeTruthy();
    const visits = screen.getByRole("region", { name: "Visites" });
    expect(within(visits).getByText("14/11/2026 · Matin")).toBeTruthy();
    expect(within(visits).getByText("Confirmée")).toBeTruthy();
    const events = screen.getByRole("list", { name: "Historique de l’intervention" });
    expect(within(events).getByText("Signalement enregistré")).toBeTruthy();
    expect(within(events).getByText("11/11/2026 à 10 h 05 · Agence")).toBeTruthy();
    expect(within(events).getByText("Le plombier passera jeudi matin.")).toBeTruthy();
    expect(within(events).getByText("10/11/2026 à 08 h 30 · Locataire")).toBeTruthy();
    const quotes = screen.getByRole("region", { name: "Devis soumis" });
    expect(within(quotes).getByText("DV-2026-0007 · Devis initial")).toBeTruthy();
    expect(within(quotes).getByText("Soumis à votre décision")).toBeTruthy();
    expect(within(quotes).getByText("Remplacement du siphon")).toBeTruthy();
    const approvals = screen.getByRole("region", { name: "Demandes d’accord" });
    expect(within(approvals).getByText("En attente de décision")).toBeTruthy();
    expect(within(approvals).getByText(/À décider avant le 26\/11\/2026 à 09 h 00/)).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Imputations à votre charge" })).getByText("FP-884")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("n'expose que les décisions prévues par l'API et le lien vers la page de validation du devis", async () => {
    stubApi({ [DETAIL]: { body: one(INTERVENTION_DETAIL) } });
    renderApi(<InterventionScreen id={INTERVENTION_ID} />);

    await screen.findByRole("region", { name: "Devis soumis" });

    expect(screen.queryAllByRole("button").map((button) => button.textContent)).toEqual(["Accepter le devis", "Refuser le devis", "Demander une précision", "Télécharger"]);
    expect(screen.getByRole("link", { name: "Valider le devis" }).getAttribute("href")).toBe(`/confie/interventions/${INTERVENTION_ID}/devis`);
  });

  it("télécharge un fichier partagé par la route du serveur", async () => {
    const downloads = captureDownloads();
    const stub = stubApi({
      [DETAIL]: { body: one(INTERVENTION_DETAIL) },
      [`GET /api/v1/owner/interventions/${INTERVENTION_ID}/files/${FILE_ID}`]: { file: { type: "image/jpeg", content: "jpeg" } },
    });
    const { user } = renderApi(<InterventionScreen id={INTERVENTION_ID} />);

    await user.click(await screen.findByRole("button", { name: "Télécharger Photo de la fuite.jpg" }));

    await waitFor(() => {
      expect(downloads.names).toEqual(["Photo-de-la-fuite.jpg"]);
    });
    expect(stub.calls.find((call) => call.path.endsWith(`/files/${FILE_ID}`))?.init?.credentials).toBe("include");
  });

  it("explique qu'un fichier n'est plus partagé", async () => {
    stubApi({
      [DETAIL]: { body: one(INTERVENTION_DETAIL) },
      [`GET /api/v1/owner/interventions/${INTERVENTION_ID}/files/${FILE_ID}`]: problem(404, "owner_intervention_file_not_found"),
    });
    const { user } = renderApi(<InterventionScreen id={INTERVENTION_ID} />);

    await user.click(await screen.findByRole("button", { name: "Télécharger Photo de la fuite.jpg" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Ce fichier n’est plus partagé avec vous.");
  });

  it("présente un état vide pour une intervention sans devis ni visite", async () => {
    stubApi({ [DETAIL]: { body: one({ ...INTERVENTION_DETAIL, quotes: [], approvals: [], visits: [], files: [], invoices: [], allocations: [], events: [], description: null }) } });
    renderApi(<InterventionScreen id={INTERVENTION_ID} />);

    expect(await screen.findByText("Aucun devis n’a encore été soumis à votre décision.")).toBeTruthy();
    expect(screen.getByText("Aucune visite n’est prévue.")).toBeTruthy();
    expect(screen.getByText("Votre agence n’a partagé aucun fichier pour cette intervention.")).toBeTruthy();
    expect(screen.queryByText("Un devis attend une décision")).toBeNull();
  });

  it("signale une intervention hors de vos accès", async () => {
    stubApi({ [DETAIL]: problem(404, "owner_intervention_not_found") });
    renderApi(<InterventionScreen id={INTERVENTION_ID} />);

    expect(await screen.findByText("Cette intervention n’existe pas ou n’est plus accessible depuis votre espace.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour aux interventions" }).getAttribute("href")).toBe("/confie/interventions");
  });
});
