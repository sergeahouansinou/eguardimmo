import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INTERVENTION_IDS as IDS,
  cancelledDetail,
  commentCreated,
  confirmedDetail,
  declinedDetail,
  doneDetail,
  fileUploaded,
  interventionsEmpty,
  interventionsPage,
  interventionsPage1,
  interventionsPage2,
  notFoundProblem,
  openDetail,
  proposedDetail,
  rescheduleRequestedDetail,
  staleTransitionProblem,
} from "@/tenant/interventionResponses.fixtures";
import { expectNoA11yViolations } from "../../../test/axe";
import { renderApi, stubApi } from "../../../test/api";
import { ApiDetailScreen } from "./ApiDetailScreen";
import { ApiInterventionsScreen } from "./ApiInterventionsScreen";
import { DEMO_TEXTS, problem } from "../rent/testKit";

const BASE = "/api/v1/tenant/interventions";
const LIST = `GET ${BASE}`;
const detailKey = (id: string) => `GET ${BASE}/${id}`;
const FORBIDDEN_TEXTS = ["Devis", "Mandant", "Budget", "Facture", "Responsabilité", "€"];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("liste des interventions (api)", () => {
  it("liste les demandes réelles avec état, lieu et rendez-vous, sans donnée de démonstration", async () => {
    stubApi({ [LIST]: { body: interventionsPage } });

    const { container } = renderApi(<ApiInterventionsScreen />, { pathname: "/interventions" });

    const table = await screen.findByRole("table", { name: "Demandes d’intervention" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(4);
    expect(within(rows[0] ?? document.body).getByRole("link", { name: "Prise électrique HS" }).getAttribute("href")).toBe(`/interventions/${IDS.latest}`);
    expect(rows[0]?.textContent).toContain("INT-2026-0004");
    expect(rows[0]?.textContent).toContain("En cours d’étude");
    expect(rows[1]?.textContent).toContain("Classée sans suite");
    expect(rows[2]?.textContent).toContain("Annulée");
    expect(rows[3]?.textContent).toContain("Terminée");
    expect(rows[3]?.textContent).toContain(openDetail.data.place);
    for (const text of [...DEMO_TEXTS, ...FORBIDDEN_TEXTS]) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it("offre le signalement d’un problème", async () => {
    stubApi({ [LIST]: { body: interventionsPage } });

    renderApi(<ApiInterventionsScreen />, { pathname: "/interventions" });

    await screen.findByRole("table", { name: "Demandes d’intervention" });
    expect(screen.getByRole("link", { name: /Signaler un problème/ }).getAttribute("href")).toBe("/interventions/nouvelle");
  });

  it("annonce une liste vide", async () => {
    stubApi({ [LIST]: { body: interventionsEmpty } });

    renderApi(<ApiInterventionsScreen />, { pathname: "/interventions" });

    expect(await screen.findByText("Aucune demande")).toBeTruthy();
  });

  it("charge la page suivante par curseur", async () => {
    const stub = stubApi({
      [LIST]: (call) => ({ body: call.query.cursor === undefined ? interventionsPage1 : interventionsPage2 }),
    });

    const { user } = renderApi(<ApiInterventionsScreen />, { pathname: "/interventions" });

    await screen.findByRole("table", { name: "Demandes d’intervention" });
    await user.click(screen.getByRole("button", { name: "Afficher plus de demandes" }));

    await waitFor(() => { expect(within(screen.getByRole("table", { name: "Demandes d’intervention" })).getByRole("link", { name: "Porte qui grince" })).toBeTruthy(); });
    expect(stub.calls.filter((call) => call.path === BASE).map((call) => call.query.cursor)).toEqual([undefined, interventionsPage1.meta.next_cursor]);
  });

  it.each([
    [401, "unauthenticated", "Votre session a expiré"],
    [429, "throttle", "Trop de demandes"],
    [503, "unavailable", "momentanément indisponible"],
  ])("traduit l’erreur %s en français", async (status, code, text) => {
    stubApi({ [LIST]: { status, body: problem(status, code, "texte serveur anglais") } });

    renderApi(<ApiInterventionsScreen />, { pathname: "/interventions" });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(text);
    expect(alert.textContent).not.toContain("anglais");
  });
});

describe("détail d’une intervention (api)", () => {
  it("montre le signalement, la chronologie et les photos, sans montant ni mandant", async () => {
    stubApi({ [detailKey(IDS.open)]: { body: openDetail } });

    const { container } = renderApi(<ApiDetailScreen id={IDS.open} />, { pathname: `/interventions/${IDS.open}` });

    expect(await screen.findByRole("heading", { level: 1, name: openDetail.data.title })).toBeTruthy();
    expect(screen.getByText("Un plombier passera cette semaine.")).toBeTruthy();
    expect(screen.getAllByText(/Votre gestionnaire · /).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Télécharger Photo 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Télécharger Photo 2 (ajoutée par l’agence)" })).toBeTruthy();
    for (const text of [...DEMO_TEXTS, ...FORBIDDEN_TEXTS]) expect(document.body.textContent).not.toContain(text);
    await expectNoA11yViolations(container);
  });

  it("répond 404 par l’état introuvable", async () => {
    stubApi({ [detailKey(IDS.open)]: { status: 404, body: notFoundProblem } });

    renderApi(<ApiDetailScreen id={IDS.open} />, { pathname: `/interventions/${IDS.open}` });

    expect(await screen.findByText("Demande introuvable")).toBeTruthy();
  });

  it("confirme le rendez-vous proposé", async () => {
    const stub = stubApi({
      [detailKey(IDS.open)]: { body: proposedDetail },
      [`POST ${BASE}/${IDS.open}/visits/${IDS.visit}/confirm`]: { body: confirmedDetail },
    });

    const { user } = renderApi(<ApiDetailScreen id={IDS.open} />, { pathname: `/interventions/${IDS.open}` });

    expect(await screen.findByText("À confirmer")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Confirmer ce rendez-vous" }));

    await waitFor(() => { expect(stub.count("POST", `${BASE}/${IDS.open}/visits/${IDS.visit}/confirm`)).toBe(1); });
    await waitFor(() => { expect(stub.count("GET", `${BASE}/${IDS.open}`)).toBe(2); });
  });

  it("demande un autre créneau, jamais un déplacement immédiat", async () => {
    const stub = stubApi({
      [detailKey(IDS.open)]: { body: proposedDetail },
      [`POST ${BASE}/${IDS.open}/visits/${IDS.visit}/reschedule-request`]: { body: rescheduleRequestedDetail },
    });

    const { user } = renderApi(<ApiDetailScreen id={IDS.open} />, { pathname: `/interventions/${IDS.open}` });

    await user.click(await screen.findByRole("button", { name: "Demander un autre créneau" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Envoyer la demande" }));
    expect(within(dialog).getByText("Choisissez un créneau.")).toBeTruthy();
    expect(stub.count("POST", `${BASE}/${IDS.open}/visits/${IDS.visit}/reschedule-request`)).toBe(0);
    const date = within(dialog).getByLabelText("Date souhaitée");
    await user.type(date, "2099-01-15");
    await user.click(within(dialog).getByRole("combobox", { name: /Créneau/ }));
    await user.click(await screen.findByRole("option", { name: "Après-midi" }));
    await user.click(within(dialog).getByRole("button", { name: "Envoyer la demande" }));

    await waitFor(() => { expect(stub.count("POST", `${BASE}/${IDS.open}/visits/${IDS.visit}/reschedule-request`)).toBe(1); });
    expect(stub.calls.find((candidate) => candidate.path.endsWith("reschedule-request"))?.json).toEqual({ requested_on: "2099-01-15", slot: "afternoon" });
  });

  it("affiche la demande de report en attente sans bouton d’action", async () => {
    stubApi({ [detailKey(IDS.open)]: { body: rescheduleRequestedDetail } });

    renderApi(<ApiDetailScreen id={IDS.open} />, { pathname: `/interventions/${IDS.open}` });

    expect(await screen.findByText("Report demandé")).toBeTruthy();
    expect(screen.getByText(/le rendez-vous ne change qu’avec son accord/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirmer ce rendez-vous" })).toBeNull();
  });

  it("montre l’intervenant et son téléphone une fois le rendez-vous confirmé", async () => {
    stubApi({ [detailKey(IDS.open)]: { body: confirmedDetail } });

    renderApi(<ApiDetailScreen id={IDS.open} />, { pathname: `/interventions/${IDS.open}` });

    expect(await screen.findByText(/Plomberie Dupont/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "0491000000" }).getAttribute("href")).toBe("tel:0491000000");
  });

  it("traduit un conflit 409 à la confirmation", async () => {
    stubApi({
      [detailKey(IDS.open)]: { body: proposedDetail },
      [`POST ${BASE}/${IDS.open}/visits/${IDS.visit}/confirm`]: { status: 409, body: staleTransitionProblem },
    });

    const { user } = renderApi(<ApiDetailScreen id={IDS.open} />, { pathname: `/interventions/${IDS.open}` });

    await user.click(await screen.findByRole("button", { name: "Confirmer ce rendez-vous" }));

    expect((await screen.findByRole("alert")).textContent).toContain("a déjà avancé");
  });

  it("annule la demande après confirmation", async () => {
    const stub = stubApi({
      [detailKey(IDS.open)]: { body: openDetail },
      [`POST ${BASE}/${IDS.open}/cancel`]: { body: cancelledDetail },
    });

    const { user } = renderApi(<ApiDetailScreen id={IDS.open} />, { pathname: `/interventions/${IDS.open}` });

    await user.click(await screen.findByRole("button", { name: "Annuler la demande" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Annuler la demande" }));

    await waitFor(() => { expect(stub.count("POST", `${BASE}/${IDS.open}/cancel`)).toBe(1); });
  });

  it("ne propose pas l’annulation quand le serveur dit non annulable", async () => {
    stubApi({ [detailKey(IDS.open)]: { body: confirmedDetail } });

    renderApi(<ApiDetailScreen id={IDS.open} />, { pathname: `/interventions/${IDS.open}` });

    await screen.findByRole("heading", { level: 1, name: confirmedDetail.data.title });
    expect(screen.queryByRole("button", { name: "Annuler la demande" })).toBeNull();
  });

  it("envoie un commentaire de 500 caractères au plus", async () => {
    const stub = stubApi({
      [detailKey(IDS.open)]: { body: openDetail },
      [`POST ${BASE}/${IDS.open}/comments`]: { status: 201, body: commentCreated },
    });

    const { user } = renderApi(<ApiDetailScreen id={IDS.open} />, { pathname: `/interventions/${IDS.open}` });

    await user.click(await screen.findByRole("button", { name: "Envoyer" }));
    expect(await screen.findByText("Écrivez votre message.")).toBeTruthy();
    expect(stub.count("POST", `${BASE}/${IDS.open}/comments`)).toBe(0);
    await user.type(screen.getByLabelText("Votre message"), "Merci de passer le matin");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));

    await waitFor(() => { expect(stub.count("POST", `${BASE}/${IDS.open}/comments`)).toBe(1); });
    expect(stub.calls.find((candidate) => candidate.path.endsWith("/comments"))?.json).toEqual({ text: "Merci de passer le matin" });
  });

  it("ajoute une photo par le client authentifié", async () => {
    const stub = stubApi({
      [detailKey(IDS.open)]: { body: openDetail },
      [`POST ${BASE}/${IDS.open}/files`]: { status: 201, body: fileUploaded },
    });

    const { user } = renderApi(<ApiDetailScreen id={IDS.open} />, { pathname: `/interventions/${IDS.open}` });

    await screen.findByRole("heading", { level: 1, name: openDetail.data.title });
    const input = screen.getByLabelText("Ajouter des photos");
    await user.upload(input, new File(["x"], "evier.jpg", { type: "image/jpeg" }));
    await user.click(await screen.findByRole("button", { name: "Envoyer la photo" }));

    await waitFor(() => { expect(stub.count("POST", `${BASE}/${IDS.open}/files`)).toBe(1); });
  });

  it("explique le classement sans suite et masque les actions", async () => {
    stubApi({ [detailKey(IDS.declined)]: { body: declinedDetail } });

    renderApi(<ApiDetailScreen id={IDS.declined} />, { pathname: `/interventions/${IDS.declined}` });

    expect(await screen.findByText("Demande classée sans suite")).toBeTruthy();
    expect(screen.getAllByText(/Aucun désordre constaté\./).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Envoyer" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Annuler la demande" })).toBeNull();
  });

  it("n’offre ni message ni ajout de photo sur une demande terminée", async () => {
    stubApi({ [detailKey(IDS.open)]: { body: doneDetail } });

    renderApi(<ApiDetailScreen id={IDS.open} />, { pathname: `/interventions/${IDS.open}` });

    expect(await screen.findByRole("heading", { level: 1, name: doneDetail.data.title })).toBeTruthy();
    expect(screen.queryByLabelText("Votre message")).toBeNull();
    expect(screen.queryByLabelText("Ajouter des photos")).toBeNull();
  });
});
