import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_URL, renderApi, stubApi } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { setLocation } from "../../../test/navigation";
import { ACCESS_ENTRY, problem } from "../responses.fixtures";
import { one, page } from "../shared/fixtures";
import { END_REQUEST, MANDATE, MANDATE_ID, MANDATE_WITH_REQUEST } from "./fixtures";
import { MandateEndScreen } from "./MandateEndScreen";
import { MandatesScreen } from "./MandatesScreen";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const LIST = "GET /api/v1/owner/mandates";
const DETAIL = `GET /api/v1/owner/mandates/${MANDATE_ID}`;
const END = `/api/v1/owner/mandates/${MANDATE_ID}/end-request`;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("mandats en mode api", () => {
  beforeEach(() => {
    setLocation("/confie/agence/mandat");
  });

  it("affiche les conditions du mandat avec les chiffres du serveur et passe l'axe", async () => {
    stubApi({ [LIST]: { body: page([MANDATE]) } });
    const { container } = renderApi(<MandatesScreen />);

    expect(await screen.findByRole("region", { name: "Mandat MAN-2025-014" })).toBeTruthy();
    expect(screen.getByText("En cours")).toBeTruthy();
    expect(screen.getByText("Gestion locative")).toBeTruthy();
    expect(screen.getByText(/7 % du loyer charges comprises toutes taxes comprises, minimum 15 € par mois/)).toBeTruthy();
    expect(screen.getByText("Le 10 de chaque mois")).toBeTruthy();
    expect(screen.getByText("Tacite, par périodes de 12 mois")).toBeTruthy();
    expect(screen.getByText("3 mois")).toBeTruthy();
    expect(screen.getByText(/Résidence Les Filaos · lot A1/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Demander la fin du mandat" }).getAttribute("href")).toBe(`/confie/agence/mandat/fin?mandat=${MANDATE_ID}`);
    await expectNoA11yViolations(container);
  });

  it("affiche un état vide et traduit une erreur", async () => {
    stubApi({ [LIST]: { body: page([]) } });
    renderApi(<MandatesScreen />);
    expect(await screen.findByText("Aucun mandat")).toBeTruthy();
  });

  it("traduit une session expirée", async () => {
    stubApi({ [LIST]: problem(401, "unauthenticated") });
    renderApi(<MandatesScreen />);
    expect(await screen.findByText("Votre session a expiré. Reconnectez-vous pour continuer.")).toBeTruthy();
  });

  it("montre la demande de fin en cours sans promesse sur le préavis, et masque la demande", async () => {
    stubApi({ [LIST]: { body: page([MANDATE_WITH_REQUEST]) } });
    renderApi(<MandatesScreen />);

    expect(await screen.findByText("Demande de fin de mandat en cours")).toBeTruthy();
    expect(screen.getByText(/La résiliation n’est effective qu’après traitement par l’agence/)).toBeTruthy();
    expect(screen.getByText(/Je souhaite vendre le bien\./)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Demander la fin du mandat" })).toBeNull();
  });

  it("n'affiche plus une demande de fin annulée et propose de nouveau la demande", async () => {
    stubApi({ [LIST]: { body: page([{ ...MANDATE, end_request: { ...END_REQUEST, status: "cancelled", cancelled_at: "2026-11-19T10:00:00+00:00" } }]) } });
    renderApi(<MandatesScreen />);

    expect(await screen.findByRole("link", { name: "Demander la fin du mandat" })).toBeTruthy();
    expect(screen.queryByText("Demande de fin de mandat en cours")).toBeNull();
  });

  it("annule la demande après confirmation", async () => {
    const stub = stubApi({ [LIST]: { body: page([MANDATE_WITH_REQUEST]) }, [`DELETE ${END}`]: { body: one({ ...END_REQUEST, status: "cancelled", cancelled_at: "2026-11-19T10:00:00+00:00" }) } });
    const { user } = renderApi(<MandatesScreen />);
    await user.click(await screen.findByRole("button", { name: "Annuler ma demande" }));
    const dialog = await screen.findByRole("dialog");
    expect(stub.count("DELETE", END)).toBe(0);
    await user.click(within(dialog).getByRole("button", { name: "Annuler ma demande" }));

    await waitFor(() => {
      expect(stub.count("DELETE", END)).toBe(1);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("masque la demande pour un accès en grâce", async () => {
    stubApi({
      [LIST]: { body: page([MANDATE]) },
      "GET /api/v1/owner/agencies": { body: { data: [{ ...ACCESS_ENTRY, in_grace: true, read_only: true, access_until: "2026-12-31" }] } },
    });
    renderApi(<MandatesScreen />);

    expect(await screen.findByText("Lecture seule")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Demander la fin du mandat" })).toBeNull();
  });

  it("ne propose pas la demande sur un mandat résilié", async () => {
    stubApi({ [LIST]: { body: page([{ ...MANDATE, status: "terminated" }]) } });
    renderApi(<MandatesScreen />);
    expect(await screen.findByText("Résilié")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Demander la fin du mandat" })).toBeNull();
  });
});

describe("demande de fin de mandat en mode api", () => {
  beforeEach(() => {
    setLocation("/confie/agence/mandat/fin", `?mandat=${MANDATE_ID}`);
  });

  async function openConfirmation(reason: string) {
    const stub = stubApi({ [DETAIL]: { body: one(MANDATE) }, [`POST ${END}`]: { status: 201, body: one(END_REQUEST) } });
    const view = renderApi(<MandateEndScreen />);
    if (reason !== "") await view.user.type(await screen.findByLabelText("Motif (facultatif)"), reason);
    await view.user.click(await screen.findByRole("button", { name: "Demander la fin du mandat" }));
    return { ...view, stub, dialog: await screen.findByRole("dialog") };
  }

  it("envoie la demande avec le motif après confirmation et affiche un texte neutre", async () => {
    const { user, stub, dialog } = await openConfirmation("Vente du bien");
    expect(dialog.textContent).toContain("La résiliation n’est effective qu’après traitement par l’agence");
    expect(stub.count("POST", END)).toBe(0);
    await user.click(within(dialog).getByRole("button", { name: "Envoyer la demande" }));

    expect(await screen.findByText("Demande envoyée à votre agence")).toBeTruthy();
    expect(stub.calls.find((call) => call.method === "POST")?.json).toEqual({ reason: "Vente du bien" });
    expect(document.body.textContent).not.toMatch(/préavis de|garanti|effective le/i);
  });

  it("garde l'annonce d'envoi et affiche la demande en cours une fois le mandat rechargé", async () => {
    let sent = false;
    stubApi({
      [DETAIL]: () => ({ body: one(sent ? MANDATE_WITH_REQUEST : MANDATE) }),
      [`POST ${END}`]: () => {
        sent = true;
        return { status: 201, body: one(END_REQUEST) };
      },
    });
    const { user } = renderApi(<MandateEndScreen />);
    await user.click(await screen.findByRole("button", { name: "Demander la fin du mandat" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Envoyer la demande" }));

    expect(await screen.findByText("Demande envoyée à votre agence")).toBeTruthy();
    expect(await screen.findByText("Demande de fin de mandat en cours")).toBeTruthy();
    expect(screen.queryByLabelText("Motif (facultatif)")).toBeNull();
  });

  it("envoie une demande sans motif avec un corps vide", async () => {
    const { user, stub, dialog } = await openConfirmation("");
    await user.click(within(dialog).getByRole("button", { name: "Envoyer la demande" }));

    await screen.findByText("Demande envoyée à votre agence");
    expect(stub.calls.find((call) => call.method === "POST")?.json).toEqual({});
  });

  it("renvoie vers la confirmation par code quand la preuve 2FA récente manque", async () => {
    stubApi({ [DETAIL]: { body: one(MANDATE) }, [`POST ${END}`]: problem(403, "reauthentication_required") });
    const { user } = renderApi(<MandateEndScreen />);
    await user.click(await screen.findByRole("button", { name: "Demander la fin du mandat" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Envoyer la demande" }));

    const link = await within(dialog).findByRole("link", { name: "Confirmer mon identité" });
    expect(new URL(link.getAttribute("href") ?? "").origin).toBe(AUTH_URL);
  });

  it("traduit un mandat devenu inactif", async () => {
    stubApi({ [DETAIL]: { body: one(MANDATE) }, [`POST ${END}`]: problem(409, "mandate_not_active") });
    const { user } = renderApi(<MandateEndScreen />);
    await user.click(await screen.findByRole("button", { name: "Demander la fin du mandat" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Envoyer la demande" }));

    expect(await within(dialog).findByText(/n’est plus actif/)).toBeTruthy();
  });

  it("affiche la demande existante plutôt que le formulaire", async () => {
    stubApi({ [DETAIL]: { body: one(MANDATE_WITH_REQUEST) } });
    renderApi(<MandateEndScreen />);

    expect(await screen.findByText("Demande de fin de mandat en cours")).toBeTruthy();
    expect(screen.queryByLabelText("Motif (facultatif)")).toBeNull();
  });

  it("masque le formulaire en lecture seule", async () => {
    stubApi({
      [DETAIL]: { body: one(MANDATE) },
      "GET /api/v1/owner/agencies": { body: { data: [{ ...ACCESS_ENTRY, role: "co_owner", read_only: true }] } },
    });
    renderApi(<MandateEndScreen />);

    expect(await screen.findByText("Lecture seule")).toBeTruthy();
    expect(screen.queryByLabelText("Motif (facultatif)")).toBeNull();
  });

  it("demande de choisir un mandat quand l'identifiant manque ou est invalide", async () => {
    setLocation("/confie/agence/mandat/fin", "?mandat=pas-un-uuid");
    const stub = stubApi();
    renderApi(<MandateEndScreen />);

    expect(await screen.findByText("Aucun mandat sélectionné")).toBeTruthy();
    expect(stub.calls.filter((call) => call.path.includes("/mandates"))).toHaveLength(0);
  });

  it("traduit un mandat introuvable et passe l'axe sur le formulaire", async () => {
    stubApi({ [DETAIL]: problem(404, "owner_mandate_not_found") });
    renderApi(<MandateEndScreen />);
    expect(await screen.findByText(/n’existe pas ou n’est plus accessible/)).toBeTruthy();
  });

  it("n'a aucune violation d'accessibilité sur le formulaire", async () => {
    stubApi({ [DETAIL]: { body: one(MANDATE) } });
    const { container } = renderApi(<MandateEndScreen />);
    await screen.findByLabelText("Motif (facultatif)");
    await expectNoA11yViolations(container);
  });
});
