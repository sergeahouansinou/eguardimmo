import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ID, ORG_PORT, contactUpdate, page, problem, profile } from "@/tenant/complementsResponses.fixtures";
import { PENDING_EMAIL_KEY } from "@/tenant/pendingEmail";
import { links } from "@/tenant/responses.fixtures";
import { expectNoA11yViolations } from "../../../test/axe";
import { renderApi, stubApi } from "../../../test/api";
import { ApiModifierScreen } from "./ApiModifierScreen";

const ME = "GET /api/v1/me";
const LINKS = "GET /api/v1/tenant/links";
const UPDATES = "GET /api/v1/tenant/contact-updates";
const stubs = () => ({ [ME]: { body: profile() }, [LINKS]: { body: links([{ id: "0193a5e2-0000-7000-8000-00000000000a", organization: ORG_PORT }]) }, [UPDATES]: { body: page([]) } });
const open = () => renderApi(<ApiModifierScreen />, { pathname: "/compte/modifier" });

beforeEach(() => {
  globalThis.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("modifier mes informations : nom et téléphone", () => {
  it("enregistre le nom", async () => {
    const api = stubApi({ ...stubs(), "PATCH /api/v1/me": { body: profile({ name: "Awa Koné-Diallo" }) } });

    const { user, container } = open();
    const field = await screen.findByLabelText("Nom complet *");
    await user.clear(field);
    await user.type(field, "Awa Koné-Diallo");
    await user.click(screen.getByRole("button", { name: "Enregistrer le nom" }));

    await waitFor(() => { expect(api.count("PATCH", "/api/v1/me")).toBe(1); });
    expect(api.calls.find((call) => call.method === "PATCH")?.json).toEqual({ name: "Awa Koné-Diallo" });
    expect(await screen.findByText("Nom enregistré")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it.each([["A", /2 caractères au minimum/], ["Awa <script>", /caractère non autorisé/]])("refuse le nom %s sans appel", async (value, message) => {
    const api = stubApi(stubs());

    const { user } = open();
    const field = await screen.findByLabelText("Nom complet *");
    await user.clear(field);
    await user.type(field, value);
    await user.click(screen.getByRole("button", { name: "Enregistrer le nom" }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(api.calls.some((call) => call.method === "PATCH")).toBe(false);
  });

  it("enregistre puis retire le téléphone", async () => {
    const api = stubApi({ ...stubs(), "PUT /api/v1/me/phone": { body: profile({ phone: "+33698765432" }) } });

    const { user } = open();
    const field = await screen.findByLabelText("Téléphone (facultatif)");
    expect((field as HTMLInputElement).value).toBe("+33612345678");
    await user.clear(field);
    await user.type(field, "+33698765432");
    await user.click(screen.getByRole("button", { name: "Enregistrer le téléphone" }));
    await waitFor(() => { expect(api.count("PUT", "/api/v1/me/phone")).toBe(1); });
    await user.clear(screen.getByLabelText("Téléphone (facultatif)"));
    await user.click(screen.getByRole("button", { name: "Enregistrer le téléphone" }));

    await waitFor(() => { expect(api.count("PUT", "/api/v1/me/phone")).toBe(2); });
    const bodies = api.calls.filter((call) => call.method === "PUT").map((call) => call.json);
    expect(bodies).toEqual([{ phone: "+33698765432" }, { phone: null }]);
  });

  it("refuse un numéro trop long sans appel", async () => {
    const api = stubApi(stubs());

    const { user } = open();
    fireEvent.change(await screen.findByLabelText("Téléphone (facultatif)"), { target: { value: "1".repeat(40) } });
    await user.click(screen.getByRole("button", { name: "Enregistrer le téléphone" }));

    expect(await screen.findByText(/Le numéro est trop long/)).toBeTruthy();
    expect(api.calls.some((call) => call.method === "PUT")).toBe(false);
  });

  it("traduit un numéro refusé par le serveur", async () => {
    stubApi({ ...stubs(), "PUT /api/v1/me/phone": { status: 422, body: problem(422, "phone_invalid", "x") } });

    const { user } = open();
    const field = await screen.findByLabelText("Téléphone (facultatif)");
    await user.clear(field);
    await user.type(field, "0612");
    await user.click(screen.getByRole("button", { name: "Enregistrer le téléphone" }));

    expect(await screen.findByText(/Ce numéro de téléphone est invalide/)).toBeTruthy();
  });

  it("demande de confirmer l’identité quand le serveur l’exige, avec retour sur la page", async () => {
    stubApi({ ...stubs(), "PUT /api/v1/me/phone": { status: 403, body: problem(403, "reauthentication_required", "x") } });

    const { user } = open();
    const field = await screen.findByLabelText("Téléphone (facultatif)");
    await user.clear(field);
    await user.type(field, "+33698765432");
    await user.click(screen.getByRole("button", { name: "Enregistrer le téléphone" }));

    const link = await screen.findByRole("link", { name: "Confirmer mon identité" });
    const href = new URL(link.getAttribute("href") ?? "");
    expect(href.origin).toBe("http://auth.test");
    expect(href.pathname).toBe("/compte/securite/confirmation");
    expect(href.searchParams.get("suite")).toContain("/continuer?return_to=");
    expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();
  });
});

describe("modifier mes informations : adresse e-mail", () => {
  const REQUEST = "POST /api/v1/me/email-change";
  const CONFIRM = "POST /api/v1/me/email-change/confirmation";

  async function request(user: ReturnType<typeof renderApi>["user"], email = "awa@nouvelle-adresse.test") {
    await user.type(await screen.findByLabelText("Nouvelle adresse e-mail *"), email);
    await user.click(screen.getByRole("button", { name: "Recevoir un code" }));
  }

  it("envoie le code puis confirme avec le code reçu", async () => {
    const api = stubApi({ ...stubs(), [REQUEST]: { status: 202, body: { data: { status: "code_sent", expires_in_minutes: 15 } } }, [CONFIRM]: { body: profile({ email: "awa@nouvelle-adresse.test" }) } });

    const { user } = open();
    await request(user);
    expect(await screen.findByText("Changement en attente de confirmation")).toBeTruthy();
    expect(screen.getByText(/awa@nouvelle-adresse.test/, { selector: "span" })).toBeTruthy();
    expect(api.calls.find((call) => call.path === "/api/v1/me/email-change")?.json).toEqual({ email: "awa@nouvelle-adresse.test" });
    expect(globalThis.sessionStorage.getItem(PENDING_EMAIL_KEY)).toContain("awa@nouvelle-adresse.test");
    await user.type(screen.getByLabelText("Code de confirmation *"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmer l’adresse" }));

    await waitFor(() => { expect(api.count("POST", "/api/v1/me/email-change/confirmation")).toBe(1); });
    expect(api.calls.find((call) => call.path.endsWith("/confirmation"))?.json).toEqual({ code: "123456" });
    expect(await screen.findByText("Adresse e-mail modifiée")).toBeTruthy();
    expect(globalThis.sessionStorage.getItem(PENDING_EMAIL_KEY)).toBeNull();
    expect(await screen.findByLabelText("Nouvelle adresse e-mail *")).toBeTruthy();
  });

  it("retrouve la demande en attente après un rechargement", async () => {
    stubApi({ ...stubs(), [REQUEST]: { status: 202, body: { data: { status: "code_sent", expires_in_minutes: 15 } } } });
    const first = open();
    await request(first.user);
    await screen.findByText("Changement en attente de confirmation");
    first.unmount();

    open();

    expect(await screen.findByText("Changement en attente de confirmation")).toBeTruthy();
    expect(screen.getByLabelText("Code de confirmation *")).toBeTruthy();
  });

  it("oublie une demande expirée", async () => {
    globalThis.sessionStorage.setItem(PENDING_EMAIL_KEY, JSON.stringify({ email: "awa@nouvelle-adresse.test", expiresAt: Date.now() - 1000 }));
    stubApi(stubs());

    open();

    expect(await screen.findByLabelText("Nouvelle adresse e-mail *")).toBeTruthy();
    expect(screen.queryByText("Changement en attente de confirmation")).toBeNull();
  });

  it("refuse l’adresse actuelle, une adresse invalide et un code mal formé sans appel", async () => {
    const api = stubApi({ ...stubs(), [REQUEST]: { status: 202, body: { data: { status: "code_sent", expires_in_minutes: 15 } } } });

    const { user } = open();
    await request(user, "awa.kone@example.test");
    expect(await screen.findByText("Cette adresse est déjà celle de votre compte.")).toBeTruthy();
    await user.clear(screen.getByLabelText("Nouvelle adresse e-mail *"));
    await user.type(screen.getByLabelText("Nouvelle adresse e-mail *"), "pas-une-adresse");
    await user.click(screen.getByRole("button", { name: "Recevoir un code" }));
    expect(await screen.findByText("Saisissez une adresse e-mail valide.")).toBeTruthy();
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);

    await user.clear(screen.getByLabelText("Nouvelle adresse e-mail *"));
    await user.type(screen.getByLabelText("Nouvelle adresse e-mail *"), "awa@nouvelle-adresse.test");
    await user.click(screen.getByRole("button", { name: "Recevoir un code" }));
    await user.type(await screen.findByLabelText("Code de confirmation *"), "12ab");
    await user.click(screen.getByRole("button", { name: "Confirmer l’adresse" }));
    expect(await screen.findByText(/Saisissez le code à 6 chiffres/)).toBeTruthy();
    expect(api.calls.some((call) => call.path.endsWith("/confirmation"))).toBe(false);
  });

  it.each([
    ["email_change_code_invalid", /Ce code est incorrect ou expiré/],
    ["email_change_attempts_exceeded", /Trop d’essais avec ce code/],
  ])("traduit l’erreur %s du serveur à la confirmation", async (code, message) => {
    stubApi({ ...stubs(), [REQUEST]: { status: 202, body: { data: { status: "code_sent", expires_in_minutes: 15 } } }, [CONFIRM]: { status: 422, body: problem(422, code, "x") } });

    const { user } = open();
    await request(user);
    await user.type(await screen.findByLabelText("Code de confirmation *"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmer l’adresse" }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(globalThis.sessionStorage.getItem(PENDING_EMAIL_KEY)).not.toBeNull();
  });

  it("annule le changement en attente", async () => {
    const api = stubApi({ ...stubs(), [REQUEST]: { status: 202, body: { data: { status: "code_sent", expires_in_minutes: 15 } } }, "DELETE /api/v1/me/email-change": { status: 204 } });

    const { user } = open();
    await request(user);
    await user.click(await screen.findByRole("button", { name: "Annuler le changement" }));

    await waitFor(() => { expect(api.count("DELETE", "/api/v1/me/email-change")).toBe(1); });
    expect(await screen.findByLabelText("Nouvelle adresse e-mail *")).toBeTruthy();
    expect(globalThis.sessionStorage.getItem(PENDING_EMAIL_KEY)).toBeNull();
  });

  it("renvoie un code à la même adresse", async () => {
    const api = stubApi({ ...stubs(), [REQUEST]: { status: 202, body: { data: { status: "code_sent", expires_in_minutes: 15 } } } });

    const { user } = open();
    await request(user);
    await user.click(await screen.findByRole("button", { name: "Renvoyer un code" }));

    await waitFor(() => { expect(api.calls.filter((call) => call.path === "/api/v1/me/email-change" && call.method === "POST")).toHaveLength(2); });
    const bodies = api.calls.filter((call) => call.method === "POST").map((call) => call.json);
    expect(bodies[1]).toEqual({ email: "awa@nouvelle-adresse.test" });
  });

  it("demande de confirmer l’identité avant d’envoyer le code", async () => {
    stubApi({ ...stubs(), [REQUEST]: { status: 403, body: problem(403, "reauthentication_required", "x") } });

    const { user } = open();
    await request(user);

    expect(await screen.findByRole("link", { name: "Confirmer mon identité" })).toBeTruthy();
    expect(globalThis.sessionStorage.getItem(PENDING_EMAIL_KEY)).toBeNull();
  });
});

describe("modifier mes informations : transmission aux agences", () => {
  const CREATE = "POST /api/v1/tenant/contact-updates";

  async function chooseAgency(user: ReturnType<typeof renderApi>["user"]) {
    await user.click(await screen.findByRole("combobox", { name: /Agence/ }));
    await user.click(await screen.findByRole("option", { name: ORG_PORT.name }));
  }

  it("transmet les coordonnées choisies à l’agence et affiche le suivi", async () => {
    const api = stubApi({ ...stubs(), [CREATE]: { status: 201, body: { data: contactUpdate() } } });

    const { user } = open();
    await chooseAgency(user);
    await user.click(screen.getByRole("checkbox", { name: "Téléphone" }));
    await user.click(screen.getByRole("button", { name: "Transmettre" }));

    await waitFor(() => { expect(api.count("POST", "/api/v1/tenant/contact-updates")).toBe(1); });
    const json = api.calls.find((call) => call.method === "POST")?.json as { organization_id: string; fields: string[]; client_id: string };
    expect(json.organization_id).toBe(ORG_PORT.id);
    expect(json.fields).toEqual(["email"]);
    expect(json.client_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByText("Coordonnées transmises")).toBeTruthy();
  });

  it("exige l’agence et au moins une coordonnée", async () => {
    const api = stubApi(stubs());

    const { user } = open();
    await user.click(await screen.findByRole("checkbox", { name: "Téléphone" }));
    await user.click(screen.getByRole("checkbox", { name: "Adresse e-mail" }));
    await user.click(screen.getByRole("button", { name: "Transmettre" }));

    expect(await screen.findByText("Cochez au moins une coordonnée à transmettre.")).toBeTruthy();
    expect(screen.getByText("Choisissez une agence.")).toBeTruthy();
    expect(api.calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("traduit le refus du serveur et rejoue avec le même identifiant", async () => {
    const api = stubApi({ ...stubs(), [CREATE]: { status: 409, body: problem(409, "contact_update_empty", "x") } });

    const { user } = open();
    await chooseAgency(user);
    await user.click(screen.getByRole("button", { name: "Transmettre" }));
    expect(await screen.findByText(/Votre compte ne porte aucune des coordonnées choisies/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Transmettre" }));

    await waitFor(() => { expect(api.calls.filter((call) => call.method === "POST")).toHaveLength(2); });
    const ids = api.calls.filter((call) => call.method === "POST").map((call) => (call.json as { client_id: string }).client_id);
    expect(ids[0]).toBe(ids[1]);
  });

  it("affiche le suivi des transmissions par agence et par statut", async () => {
    stubApi({ ...stubs(), [UPDATES]: { body: page([contactUpdate(), contactUpdate({ id: ID.submission, status: "applied", decided_at: "2026-11-20T08:00:00+00:00" })]) } });

    open();

    expect(await screen.findByText("En attente de traitement par l’agence")).toBeTruthy();
    expect(screen.getByText("Appliquée par l’agence")).toBeTruthy();
    expect(screen.getAllByText(ORG_PORT.name).length).toBeGreaterThan(1);
  });

  it("explique qu’aucune agence n’est rattachée", async () => {
    stubApi({ ...stubs(), [LINKS]: { body: links([]) } });

    open();

    expect(await screen.findByText("Aucune agence n’est rattachée à votre compte.")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Transmettre à mes agences" })).queryByRole("button", { name: "Transmettre" })).toBeNull();
  });
});
