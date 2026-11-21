import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_URL, renderApi, stubApi } from "../../../test/api";
import type { RecordedCall, Reply } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { setLocation } from "../../../test/navigation";
import { ACCESS_ID, problem } from "../responses.fixtures";
import { PAYOUT_ACCOUNT, PAYOUT_REQUEST, REQUEST_ID, TEST_IBAN, withRequest } from "./fixtures";
import { PayoutScreen } from "./PayoutScreen";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const BASE = "/api/v1/owner/payout-account";
const LIST = `GET ${BASE}`;
const CREATE = `POST ${BASE}/requests`;
const CONFIRM = `POST ${BASE}/requests/${REQUEST_ID}/confirm`;
const WITHDRAW = `DELETE ${BASE}/requests/${REQUEST_ID}`;
const CONTEST = `POST ${BASE}/contest`;

const list = (...accounts: unknown[]) => ({ body: { data: accounts } });
const callsTo = (calls: RecordedCall[], method: string, path: string) => calls.filter((call) => call.method === method && call.path === path);

function storedText(storage: Storage): string {
  const entries: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index) ?? "";
    entries.push(`${key}=${storage.getItem(key) ?? ""}`);
  }
  return entries.join("\n");
}

beforeEach(() => {
  setLocation("/confie/compte-de-paiement");
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("compte de paiement en mode api", () => {
  it("affiche le compte masqué, sans jamais l'IBAN, et passe l'axe", async () => {
    stubApi({ [LIST]: list({ ...PAYOUT_ACCOUNT, cooling_until: "2026-12-01" }) });
    const { container } = renderApi(<PayoutScreen />);

    expect(await screen.findByText("•••• 1234")).toBeTruthy();
    expect(screen.getByText("Agence du Lac · Famille Dossou")).toBeTruthy();
    expect(screen.getByText(/les reversements vers ce compte sont différés jusqu’au 01\/12\/2026/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Demander un changement de compte" })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("affiche un état vide", async () => {
    stubApi({ [LIST]: list() });
    renderApi(<PayoutScreen />);
    expect(await screen.findByText("Aucun compte de paiement")).toBeTruthy();
  });

  it("traduit une session expirée et un débit dépassé", async () => {
    stubApi({ [LIST]: problem(401, "unauthenticated") });
    renderApi(<PayoutScreen />);
    expect(await screen.findByText("Votre session a expiré. Reconnectez-vous pour continuer.")).toBeTruthy();
  });

  it.each([
    ["pending", "En attente d’approbation"],
    ["expired", "Expirée"],
    ["rejected", "Refusée ou abandonnée"],
    ["withdrawn", "Retirée"],
    ["approved", "Approuvée"],
  ])("traduit l'état %s de la demande", async (status, label) => {
    stubApi({ [LIST]: list(withRequest({ status, code_expires_at: null })) });
    renderApi(<PayoutScreen />);
    expect(await screen.findByText(label)).toBeTruthy();
    expect(screen.queryByLabelText("Code reçu par e-mail")).toBeNull();
  });

  it("n'affiche pas le motif de refus et n'a rien à saisir pour une demande refusée", async () => {
    stubApi({ [LIST]: list(withRequest({ status: "rejected", code_expires_at: null })) });
    renderApi(<PayoutScreen />);
    expect(await screen.findByText(/refus de l’agence ou nombre d’essais du code dépassé/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Demander un changement de compte" })).toBeTruthy();
  });

  it.each(["awaiting_code", "pending"])("ne propose pas de nouvelle demande tant qu'une demande est vivante (%s)", async (status) => {
    stubApi({ [LIST]: list(withRequest({ status })) });
    renderApi(<PayoutScreen />);
    expect(await screen.findByText("Dernière demande de changement")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Demander un changement de compte" })).toBeNull();
  });

  it("signale une contestation en cours", async () => {
    stubApi({ [LIST]: list({ ...PAYOUT_ACCOUNT, contested: true }) });
    renderApi(<PayoutScreen />);
    expect(await screen.findByText("Signalement en cours d’examen")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ce n’est pas moi" })).toBeNull();
  });

  it("masque les actions quand l'accès est en lecture seule", async () => {
    stubApi({ [LIST]: list({ ...PAYOUT_ACCOUNT, can_request: false }) });
    renderApi(<PayoutScreen />);
    expect(await screen.findByText(/cet accès est en lecture seule/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Demander un changement de compte" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ce n’est pas moi" })).toBeNull();
  });
});

describe("demande de changement de compte", () => {
  async function openRequest(replies: Record<string, Reply> = {}) {
    const stub = stubApi({ [LIST]: list(PAYOUT_ACCOUNT), ...replies });
    const view = renderApi(<PayoutScreen />);
    await view.user.click(await screen.findByRole("button", { name: "Demander un changement de compte" }));
    return { ...view, stub, dialog: await screen.findByRole("dialog") };
  }

  async function fill(user: ReturnType<typeof renderApi>["user"], dialog: HTMLElement, iban = TEST_IBAN) {
    await user.type(within(dialog).getByLabelText("IBAN"), iban);
    await user.type(within(dialog).getByLabelText("Titulaire du compte"), "Famille Dossou");
    await user.upload(within(dialog).getByLabelText("Justificatif (RIB)"), new File(["rib"], "rib.pdf", { type: "application/pdf" }));
  }

  it("envoie IBAN normalisé, titulaire et justificatif en multipart, sans rien conserver", async () => {
    const replies = { [CREATE]: { status: 201, body: { data: PAYOUT_REQUEST } } };
    const { user, stub, dialog } = await openRequest(replies);
    const iban = within(dialog).getByLabelText("IBAN");
    expect(iban.getAttribute("type")).toBe("password");

    await fill(user, dialog);
    await user.type(within(dialog).getByLabelText("BIC (facultatif)"), "bnpafrpp");
    await user.click(within(dialog).getByRole("button", { name: "Envoyer la demande" }));

    await screen.findByText("Demande enregistrée");
    const [call] = callsTo(stub.calls, "POST", `${BASE}/requests`);
    const body = call?.init?.body;
    expect(body).toBeInstanceOf(FormData);
    if (!(body instanceof FormData)) return;
    expect(body.get("access_id")).toBe(ACCESS_ID);
    expect(body.get("iban")).toBe("FR7630006000011234567890189");
    expect(body.get("bic")).toBe("BNPAFRPP");
    expect(body.get("holder_name")).toBe("Famille Dossou");
    expect((body.get("proof") as File).name).toBe("rib.pdf");
    expect(call?.path).not.toContain("FR76");
    expect(storedText(window.localStorage)).not.toContain("FR76");
    expect(storedText(window.sessionStorage)).not.toContain("FR76");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.innerHTML).not.toContain("3000 6000");
  });

  it("permet d'afficher puis de masquer l'IBAN saisi", async () => {
    const { user, dialog } = await openRequest();
    const iban = within(dialog).getByLabelText("IBAN");
    await user.click(within(dialog).getByRole("button", { name: "Afficher l’IBAN" }));
    expect(iban.getAttribute("type")).toBe("text");
    await user.click(within(dialog).getByRole("button", { name: "Masquer l’IBAN" }));
    expect(iban.getAttribute("type")).toBe("password");
  });

  it("refuse côté client un IBAN invalide et un justificatif manquant, sans appel réseau", async () => {
    const { user, stub, dialog } = await openRequest();
    await user.type(within(dialog).getByLabelText("IBAN"), "12");
    await user.click(within(dialog).getByRole("button", { name: "Envoyer la demande" }));

    expect(await within(dialog).findByText(/Saisissez un IBAN valide/)).toBeTruthy();
    expect(within(dialog).getByText("Indiquez le titulaire du compte.")).toBeTruthy();
    expect(within(dialog).getByText("Joignez un justificatif du compte (RIB).")).toBeTruthy();
    expect(callsTo(stub.calls, "POST", `${BASE}/requests`)).toHaveLength(0);
  });

  it("refuse un justificatif d'un type non admis", async () => {
    const { user, stub, dialog } = await openRequest();
    await user.type(within(dialog).getByLabelText("IBAN"), TEST_IBAN);
    await user.type(within(dialog).getByLabelText("Titulaire du compte"), "Famille Dossou");
    fireEvent.change(within(dialog).getByLabelText("Justificatif (RIB)"), { target: { files: [new File(["x"], "rib.exe", { type: "application/x-msdownload" })] } });
    await user.click(within(dialog).getByRole("button", { name: "Envoyer la demande" }));

    expect(await within(dialog).findByText("Le justificatif doit être un PDF, une image JPEG ou PNG.")).toBeTruthy();
    expect(callsTo(stub.calls, "POST", `${BASE}/requests`)).toHaveLength(0);
  });

  it("renvoie vers la confirmation par code quand la preuve 2FA récente manque", async () => {
    window.history.pushState({}, "", "/confie/compte-de-paiement");
    const { user, dialog } = await openRequest({ [CREATE]: problem(403, "reauthentication_required") });
    await fill(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Envoyer la demande" }));

    const link = await within(dialog).findByRole("link", { name: "Confirmer mon identité" });
    expect(new URL(link.getAttribute("href") ?? "").origin).toBe(AUTH_URL);
    expect(link.getAttribute("href")).not.toContain("FR76");
  });

  it.each([
    ["payout_account_iban_invalid", 422, "Cet IBAN n’est pas valide ou son pays n’est pas accepté."],
    ["payout_account_unchanged", 422, "Cet IBAN est déjà celui de votre compte de paiement."],
    ["payout_account_request_pending", 409, "Une demande de changement de compte de paiement est déjà en cours pour ce mandant."],
    ["two_factor_required", 403, "double authentification"],
  ])("traduit l'erreur %s sans écho de la saisie", async (code, status, text) => {
    const { user, dialog } = await openRequest({ [CREATE]: problem(status, code) });
    await fill(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Envoyer la demande" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert.textContent).toContain(text);
    expect(alert.textContent).not.toContain("FR76");
  });

  it("traduit le débit dépassé", async () => {
    const { user, dialog } = await openRequest({ [CREATE]: problem(429, "too_many_requests", { retry_after: 120 }) });
    await fill(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Envoyer la demande" }));
    expect((await within(dialog).findByRole("alert")).textContent).toMatch(/trop|patienter|minute/i);
  });

  it("garde le focus dans la fenêtre, passe l'axe et le rend au déclencheur", async () => {
    const { user, dialog } = await openRequest();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await expectNoA11yViolations(dialog);
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Demander un changement de compte" }));
  });
});

describe("code de confirmation, retrait et contestation", () => {
  it("affiche l'expiration et les essais, puis confirme le code à 6 chiffres", async () => {
    const stub = stubApi({ [LIST]: list(withRequest({})), [CONFIRM]: { body: { data: { ...PAYOUT_REQUEST, status: "pending", code_expires_at: null } } } });
    const { user, container } = renderApi(<PayoutScreen />);

    const field = await screen.findByLabelText("Code reçu par e-mail");
    expect(screen.getByText(/Valable jusqu’au 19\/11\/2026/)).toBeTruthy();
    expect(screen.getByText(/3 essais au total/)).toBeTruthy();
    await expectNoA11yViolations(container);
    await user.type(field, "12a3456");
    expect((field as HTMLInputElement).value).toBe("123456");
    await user.click(screen.getByRole("button", { name: "Confirmer le code" }));

    expect(await screen.findByText("Code confirmé")).toBeTruthy();
    expect(callsTo(stub.calls, "POST", `${BASE}/requests/${REQUEST_ID}/confirm`)[0]?.json).toEqual({ code: "123456" });
  });

  it("refuse un code incomplet sans appel", async () => {
    const stub = stubApi({ [LIST]: list(withRequest({})) });
    const { user } = renderApi(<PayoutScreen />);
    await user.type(await screen.findByLabelText("Code reçu par e-mail"), "123");
    await user.click(screen.getByRole("button", { name: "Confirmer le code" }));

    expect(await screen.findByText("Le code comporte 6 chiffres.")).toBeTruthy();
    expect(callsTo(stub.calls, "POST", `${BASE}/requests/${REQUEST_ID}/confirm`)).toHaveLength(0);
  });

  it("traduit un code erroné, vide le champ et rappelle la limite d'essais", async () => {
    stubApi({ [LIST]: list(withRequest({})), [CONFIRM]: problem(422, "payout_account_code_invalid") });
    const { user } = renderApi(<PayoutScreen />);
    const field = await screen.findByLabelText("Code reçu par e-mail");
    await user.type(field, "654321");
    await user.click(screen.getByRole("button", { name: "Confirmer le code" }));

    expect(await screen.findByText(/Le code est incorrect, expiré ou le nombre d’essais est épuisé/)).toBeTruthy();
    expect((field as HTMLInputElement).value).toBe("");
  });

  it("retire la demande après confirmation", async () => {
    const stub = stubApi({ [LIST]: list(withRequest({ status: "pending", code_expires_at: null })), [WITHDRAW]: { body: { data: { ...PAYOUT_REQUEST, status: "withdrawn" } } } });
    const { user } = renderApi(<PayoutScreen />);
    await user.click(await screen.findByRole("button", { name: "Retirer la demande" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Retirer la demande" }));

    expect(await screen.findByText("Demande retirée")).toBeTruthy();
    expect(callsTo(stub.calls, "DELETE", `${BASE}/requests/${REQUEST_ID}`)).toHaveLength(1);
  });

  it("traduit une demande devenue introuvable au retrait", async () => {
    stubApi({ [LIST]: list(withRequest({ status: "pending", code_expires_at: null })), [WITHDRAW]: problem(404, "payout_account_request_not_found") });
    const { user } = renderApi(<PayoutScreen />);
    await user.click(await screen.findByRole("button", { name: "Retirer la demande" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Retirer la demande" }));

    expect(await within(dialog).findByText(/n’existe plus/)).toBeTruthy();
  });

  it("signale « Ce n'est pas moi » après confirmation", async () => {
    const stub = stubApi({ [LIST]: list(PAYOUT_ACCOUNT), [CONTEST]: { body: { data: { access_id: ACCESS_ID, contested: true, contested_at: "2026-11-19T10:00:00+00:00" } } } });
    const { user } = renderApi(<PayoutScreen />);
    await user.click(await screen.findByRole("button", { name: "Ce n’est pas moi" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("mis en attente");
    expect(callsTo(stub.calls, "POST", `${BASE}/contest`)).toHaveLength(0);
    await user.click(within(dialog).getByRole("button", { name: "Oui, ce n’est pas moi" }));

    expect(await screen.findByText("Signalement enregistré")).toBeTruthy();
    expect(callsTo(stub.calls, "POST", `${BASE}/contest`)[0]?.json).toEqual({ access_id: ACCESS_ID });
  });

  it("annule la contestation sans appel", async () => {
    const stub = stubApi({ [LIST]: list(PAYOUT_ACCOUNT) });
    const { user } = renderApi(<PayoutScreen />);
    await user.click(await screen.findByRole("button", { name: "Ce n’est pas moi" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Annuler" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(callsTo(stub.calls, "POST", `${BASE}/contest`)).toHaveLength(0);
  });
});
