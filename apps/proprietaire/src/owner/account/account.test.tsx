import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_URL, renderApi, stubApi } from "../../../test/api";
import type { Reply } from "../../../test/api";
import { expectNoA11yViolations } from "../../../test/axe";
import { setLocation } from "../../../test/navigation";
import { problem } from "../responses.fixtures";
import { one } from "../shared/fixtures";
import { ApiInformationsScreen, ApiModifierScreen, ApiSecuriteScreen } from "./AccountScreens";
import { DEVICES, ME, PROFILES, SECURITY } from "./fixtures";
import { PENDING_EMAIL_KEY } from "./pendingEmail";

vi.mock("next/navigation", async () => (await import("../../../test/navigation")).navigationMock);
vi.mock("next/link", async () => (await import("../../../test/navigation")).linkMock);

const ME_GET = "GET /api/v1/me";
const NAME = "PATCH /api/v1/me";
const PHONE = "PUT /api/v1/me/phone";
const REQUEST = "POST /api/v1/me/email-change";
const CANCEL = "DELETE /api/v1/me/email-change";
const CONFIRM = "POST /api/v1/me/email-change/confirmation";
const CODE_SENT = { data: { status: "code_sent", expires_in_minutes: 15 } };

beforeEach(() => {
  setLocation("/confie/informations");
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("mes informations en mode api", () => {
  it("affiche l'identité du compte et ses espaces, sans donnée d'exemple", async () => {
    stubApi({ [ME_GET]: { body: one(ME) }, "GET /api/v1/me/profiles": { body: PROFILES } });
    const { container } = renderApi(<ApiInformationsScreen />);

    const identity = await screen.findByRole("region", { name: "Identité" });
    expect(await within(identity).findByText("Aline Dossou")).toBeTruthy();
    expect(within(identity).getByText("aline@example.test")).toBeTruthy();
    expect(within(await screen.findByRole("region", { name: "Mes espaces" })).getByText("Propriétaire mandant")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Modifier mes informations" }).getAttribute("href")).toBe("/confie/informations/modifier");
    expect(screen.getByRole("link", { name: "Écrire à l’agence" }).getAttribute("href")).toBe("/confie/messages/nouveau");
    expect(document.body.textContent).not.toContain("SCI Chevalier");
    await expectNoA11yViolations(container);
  });

  it("traduit une session expirée", async () => {
    stubApi({ [ME_GET]: problem(401, "unauthenticated"), "GET /api/v1/me/profiles": { body: PROFILES } });
    renderApi(<ApiInformationsScreen />);

    expect(await screen.findByText("Votre session a expiré. Reconnectez-vous pour continuer.")).toBeTruthy();
  });
});

describe("sécurité en mode api", () => {
  it("affiche la double authentification, les comptes liés et les appareils du serveur", async () => {
    stubApi({ "GET /api/v1/me/security": { body: one(SECURITY) }, "GET /api/v1/me/devices": { body: DEVICES } });
    const { container } = renderApi(<ApiSecuriteScreen />);

    const connection = await screen.findByRole("region", { name: "Connexion" });
    expect(await within(connection).findByText("Activée")).toBeTruthy();
    expect(within(connection).getByText(/6 codes de secours restants sur 8/)).toBeTruthy();
    expect(within(connection).getByText(/Google \(aline@gmail.test\)/)).toBeTruthy();
    expect(await screen.findByText("iPhone d’Aline")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Gérer la double authentification/ }).getAttribute("href")).toContain("/compte/securite/double-authentification");
    await expectNoA11yViolations(container);
  });

  it("affiche l'échec de lecture avec une relance", async () => {
    const stub = stubApi({ "GET /api/v1/me/security": problem(500, "server_error"), "GET /api/v1/me/devices": { body: DEVICES } });
    const { user } = renderApi(<ApiSecuriteScreen />);

    expect(await screen.findByText("L’état de sécurité n’a pas pu être chargé")).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "Réessayer" }).at(0) ?? document.body);
    await waitFor(() => { expect(stub.count("GET", "/api/v1/me/security")).toBe(2); });
  });
});

describe("modifier mes informations en mode api", () => {
  async function open(initial: Record<string, Reply> = {}) {
    const stub = stubApi({ [ME_GET]: { body: one(ME) }, ...initial });
    const view = renderApi(<ApiModifierScreen />);
    await screen.findByRole("textbox", { name: /Nom complet/ });
    return { stub, ...view };
  }

  it("enregistre le nom sans les espaces superflus", async () => {
    const { stub, user, container } = await open({ [NAME]: { body: one({ ...ME, name: "Aline Dossou-Kpossou" }) } });

    const field = screen.getByRole("textbox", { name: /Nom complet/ });
    expect((field as HTMLInputElement).value).toBe("Aline Dossou");
    const save = screen.getByRole("button", { name: "Enregistrer le nom" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    await user.clear(field);
    await user.type(field, "  Aline Dossou-Kpossou  ");
    await user.click(save);

    expect(await screen.findByText("Nom enregistré")).toBeTruthy();
    expect(stub.calls.find((call) => call.method === "PATCH")?.json).toEqual({ name: "Aline Dossou-Kpossou" });
    await expectNoA11yViolations(container);
  });

  it("refuse un nom trop court ou avec un caractère interdit avant tout appel", async () => {
    const { stub, user } = await open();

    const field = screen.getByRole("textbox", { name: /Nom complet/ });
    await user.clear(field);
    await user.type(field, "A");
    await user.click(screen.getByRole("button", { name: "Enregistrer le nom" }));
    expect(await screen.findByText("Indiquez votre nom (2 caractères au minimum).")).toBeTruthy();
    await user.clear(field);
    await user.type(field, "Aline <b>");
    await user.click(screen.getByRole("button", { name: "Enregistrer le nom" }));
    expect(await screen.findByText("Votre nom contient un caractère non autorisé.")).toBeTruthy();
    expect(stub.calls.some((call) => call.method === "PATCH")).toBe(false);
  });

  it("enregistre le téléphone, ou le retire quand le champ est vidé", async () => {
    const { stub, user } = await open({ [PHONE]: { body: one({ ...ME, phone: "+22997000000" }) } });

    const field = screen.getByRole("textbox", { name: /Téléphone/ });
    await user.clear(field);
    await user.type(field, "+229 97 00 00 00");
    await user.click(screen.getByRole("button", { name: "Enregistrer le téléphone" }));
    expect(await screen.findByText("Téléphone enregistré")).toBeTruthy();
    stub.on("PUT", "/api/v1/me/phone", { body: one({ ...ME, phone: null }) });
    await user.clear(field);
    await user.click(screen.getByRole("button", { name: "Enregistrer le téléphone" }));

    expect(await screen.findByText("Téléphone retiré")).toBeTruthy();
    const bodies = stub.calls.filter((call) => call.method === "PUT").map((call) => call.json);
    expect(bodies).toEqual([{ phone: "+229 97 00 00 00" }, { phone: null }]);
  });

  it("renvoie vers la confirmation du mot de passe quand le serveur exige une confirmation récente", async () => {
    const { user } = await open({ [PHONE]: problem(403, "reauthentication_required") });

    const field = screen.getByRole("textbox", { name: /Téléphone/ });
    await user.clear(field);
    await user.type(field, "+33 6 00 00 00 01");
    await user.click(screen.getByRole("button", { name: "Enregistrer le téléphone" }));

    expect(await screen.findByText(/confirmez votre identité avec votre mot de passe/)).toBeTruthy();
    const link = screen.getByRole("link", { name: "Confirmer mon identité" });
    const target = new URL(link.getAttribute("href") ?? "");
    expect(target.origin + target.pathname).toBe(`${AUTH_URL}/compte/securite/confirmation`);
    expect(target.searchParams.get("exige")).toBeNull();
    expect(target.searchParams.get("suite")).toContain("/continuer?return_to=");
  });

  it("traduit un numéro refusé par le serveur", async () => {
    const { user } = await open({ [PHONE]: problem(422, "phone_invalid") });

    const field = screen.getByRole("textbox", { name: /Téléphone/ });
    await user.clear(field);
    await user.type(field, "abc");
    await user.click(screen.getByRole("button", { name: "Enregistrer le téléphone" }));

    expect(await screen.findByText(/Ce numéro de téléphone est invalide/)).toBeTruthy();
  });

  it("demande un code, mémorise l'adresse en attente puis confirme avec le code reçu", async () => {
    const { stub, user } = await open({ [REQUEST]: { status: 202, body: CODE_SENT }, [CONFIRM]: { body: one({ ...ME, email: "aline.dossou@example.com" }) } });

    await user.type(screen.getByRole("textbox", { name: /Nouvelle adresse e-mail/ }), " aline.dossou@example.com ");
    await user.click(screen.getByRole("button", { name: "Recevoir un code" }));

    expect(await screen.findByText("Changement en attente de confirmation")).toBeTruthy();
    expect(stub.calls.find((call) => call.method === "POST" && call.path.endsWith("/email-change"))?.json).toEqual({ email: "aline.dossou@example.com" });
    expect(window.sessionStorage.getItem(PENDING_EMAIL_KEY)).toContain("aline.dossou@example.com");

    await user.type(screen.getByRole("textbox", { name: /Code de confirmation/ }), "12ab");
    await user.click(screen.getByRole("button", { name: "Confirmer l’adresse" }));
    expect(await screen.findByText("Saisissez le code à 6 chiffres reçu par e-mail.")).toBeTruthy();
    expect(stub.calls.some((call) => call.path.endsWith("/confirmation"))).toBe(false);

    await user.clear(screen.getByRole("textbox", { name: /Code de confirmation/ }));
    await user.type(screen.getByRole("textbox", { name: /Code de confirmation/ }), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmer l’adresse" }));

    expect(await screen.findByText("Adresse e-mail modifiée")).toBeTruthy();
    expect(stub.calls.find((call) => call.path.endsWith("/confirmation"))?.json).toEqual({ code: "123456" });
    expect(window.sessionStorage.getItem(PENDING_EMAIL_KEY)).toBeNull();
  });

  it("refuse l'adresse déjà utilisée par le compte et une adresse invalide sans appel", async () => {
    const { stub, user } = await open();

    const field = screen.getByRole("textbox", { name: /Nouvelle adresse e-mail/ });
    await user.type(field, "ALINE@example.test");
    await user.click(screen.getByRole("button", { name: "Recevoir un code" }));
    expect(await screen.findByText("Cette adresse est déjà celle de votre compte.")).toBeTruthy();
    await user.clear(field);
    await user.type(field, "pas-une-adresse");
    await user.click(screen.getByRole("button", { name: "Recevoir un code" }));
    expect(await screen.findByText("Saisissez une adresse e-mail valide.")).toBeTruthy();
    expect(stub.calls.some((call) => call.path.endsWith("/email-change"))).toBe(false);
  });

  it("annule un changement en attente côté serveur", async () => {
    window.sessionStorage.setItem(PENDING_EMAIL_KEY, JSON.stringify({ email: "nouvelle@example.com", expiresAt: Date.now() + 600_000 }));
    const { stub, user } = await open({ [CANCEL]: { status: 204 } });

    expect(await screen.findByText(/Un code à 6 chiffres a été envoyé à nouvelle@example.com/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Annuler le changement" }));

    expect(await screen.findByRole("textbox", { name: /Nouvelle adresse e-mail/ })).toBeTruthy();
    expect(stub.count("DELETE", "/api/v1/me/email-change")).toBe(1);
    expect(window.sessionStorage.getItem(PENDING_EMAIL_KEY)).toBeNull();
  });

  it("traduit un code erroné puis un blocage après trop d'essais", async () => {
    window.sessionStorage.setItem(PENDING_EMAIL_KEY, JSON.stringify({ email: "nouvelle@example.com", expiresAt: Date.now() + 600_000 }));
    const { stub, user } = await open({ [CONFIRM]: problem(422, "email_change_code_invalid") });

    const field = await screen.findByRole("textbox", { name: /Code de confirmation/ });
    await user.type(field, "000000");
    await user.click(screen.getByRole("button", { name: "Confirmer l’adresse" }));
    expect(await screen.findByText(/Ce code est incorrect ou expiré/)).toBeTruthy();

    stub.on("POST", "/api/v1/me/email-change/confirmation", problem(429, "email_change_attempts_exceeded"));
    await user.click(screen.getByRole("button", { name: "Confirmer l’adresse" }));
    expect(await screen.findByText(/Trop de codes erronés/)).toBeTruthy();
    expect(window.sessionStorage.getItem(PENDING_EMAIL_KEY)).not.toBeNull();
  });

  it("ignore un changement en attente expiré", async () => {
    window.sessionStorage.setItem(PENDING_EMAIL_KEY, JSON.stringify({ email: "nouvelle@example.com", expiresAt: Date.now() - 1000 }));
    await open();

    expect(await screen.findByRole("textbox", { name: /Nouvelle adresse e-mail/ })).toBeTruthy();
    expect(screen.queryByText("Changement en attente de confirmation")).toBeNull();
  });

  it("affiche l'échec de chargement du profil", async () => {
    stubApi({ [ME_GET]: problem(500, "server_error") });
    renderApi(<ApiModifierScreen />);

    expect(await screen.findByText("Vos informations n’ont pas pu être chargées")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
