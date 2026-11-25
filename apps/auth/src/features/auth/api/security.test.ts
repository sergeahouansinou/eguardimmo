import { describe, expect, it } from "vitest";
import { securitySchema } from "../schemas";
import * as api from "./responses.fixtures";
import { UNAVAILABLE_MESSAGE } from "./index";
import { emptyJson, json, noContent, problem, setup, validation } from "./testing";

const passwordRequired = () => json(423, { message: "Password confirmation required." });
const reauthRequired = () => problem(403, "reauthentication_required");

describe("source API : confirmation d’identité", () => {
  it("confirme le mot de passe (201 de Fortify)", async () => {
    const { source, call } = setup([emptyJson(201)]);

    expect(await source.confirmPassword("Motdepasse1")).toEqual({ status: "confirmed" });
    expect(call(0).url.pathname).toBe("/auth/user/confirm-password");
    expect(call(0).body).toEqual({ password: "Motdepasse1" });
  });

  it("confirme par code TOTP", async () => {
    const { source, call } = setup([noContent()]);

    expect(await source.confirmCode("123456")).toEqual({ status: "confirmed" });
    expect(call(0).url.pathname).toBe("/auth/reauthenticate/two-factor");
    expect(call(0).body).toEqual({ code: "123456" });
  });

  it("traduit 422 en refus, 429 en verrouillage et propage 401 pour les deux confirmations", async () => {
    expect(await setup([validation({ password: ["Mot de passe incorrect."] })]).source.confirmPassword("faux")).toEqual({ status: "invalid" });
    expect(await setup([validation({ code: ["Code invalide."] })]).source.confirmCode("000000")).toEqual({ status: "invalid" });
    expect(await setup([problem(429, "too_many_requests", { retryAfter: 600 })]).source.confirmPassword("x")).toEqual({
      status: "locked",
      retryAfterSeconds: 600,
    });
    expect(await setup([problem(429, "too_many_requests", { retryAfter: 12 })]).source.confirmCode("000000")).toEqual({
      status: "locked",
      retryAfterSeconds: 12,
    });
    await expect(setup([problem(401, "unauthenticated")]).source.confirmPassword("x")).rejects.toMatchObject({ status: 401 });
  });
});

describe("source API : synthèse de sécurité", () => {
  it("lit l’aperçu de sécurité du serveur et le traduit pour l’écran", async () => {
    const { source, call } = setup([json(200, api.securityResponse)]);
    const security = securitySchema.parse(await source.getSecurity());

    expect(call(0).url.pathname).toBe("/api/v1/me/security");
    expect(call(0).method).toBe("GET");
    expect(security).toEqual({
      email: "jeanne@exemple.fr",
      emailVerified: true,
      hasPassword: true,
      passwordChangedAt: null,
      twoFactor: { enabled: true, enabledAt: "2026-11-12T08:15:00.000Z", backupCodesRemaining: 6, backupCodesTotal: 8 },
      linkedAccounts: [
        { provider: "google", linked: true, email: "jeanne@gmail.test", linkedAt: "2026-11-11T10:00:00.000Z" },
        { provider: "apple", linked: false, email: null, linkedAt: null },
      ],
      devices: [
        { id: api.IDS.device, name: "iPhone de Jeanne", type: "mobile", location: null, lastActivityAt: "2026-11-14T18:30:00.000Z", current: false },
      ],
      confirmedUntil: "2026-11-15T10:05:00.000Z",
      confirmedWithCodeUntil: null,
    });
  });

  it("propage 401 sans session et refuse une réponse mal formée", async () => {
    await expect(setup([problem(401, "unauthenticated")]).source.getSecurity()).rejects.toMatchObject({ status: 401 });
    await expect(setup([json(200, { data: { email: "x" } })]).source.getSecurity()).rejects.toThrow("Réponse inattendue");
  });

  it("retient l’état 2FA lu pour demander un code à la suppression", async () => {
    const { source } = setup([json(200, api.securityResponse), reauthRequired()]);

    await source.getSecurity();
    expect(await source.deleteAccount()).toEqual({ status: "confirmation_required", needsCode: true });
  });
});

describe("source API : double authentification", () => {
  it("active la 2FA puis lit la clé et l’URI otpauth", async () => {
    const { source, call } = setup([emptyJson(200), json(200, api.secretKeyResponse), json(200, api.qrCodeResponse)]);

    expect(await source.startTwoFactorSetup()).toEqual({ secret: "JBSWY3DPEHPK3PXP", otpauthUri: api.qrCodeResponse.url });
    expect(call(0)).toMatchObject({ method: "POST" });
    expect(call(0).url.pathname).toBe("/auth/user/two-factor-authentication");
    expect(call(1).url.pathname).toBe("/auth/user/two-factor-secret-key");
    expect(call(2).url.pathname).toBe("/auth/user/two-factor-qr-code");
  });

  it("propage 423 au démarrage de la configuration (confirmation du mot de passe requise) et refuse un QR vide", async () => {
    await expect(setup([passwordRequired()]).source.startTwoFactorSetup()).rejects.toMatchObject({ status: 423 });
    await expect(
      setup([emptyJson(200), json(200, api.secretKeyResponse), json(200, [])]).source.startTwoFactorSetup(),
    ).rejects.toThrow("Réponse inattendue");
  });

  it("confirme l’activation par un code TOTP et renvoie les codes de secours", async () => {
    const { source, call } = setup([emptyJson(200), json(200, api.recoveryCodesResponse)]);

    expect(await source.enableTwoFactor("123456")).toEqual({ status: "ok", backupCodes: api.recoveryCodesResponse });
    expect(call(0).url.pathname).toBe("/auth/user/confirmed-two-factor-authentication");
    expect(call(0).body).toEqual({ code: "123456" });
    expect(call(1).url.pathname).toBe("/auth/user/two-factor-recovery-codes");
    expect(call(1).method).toBe("GET");
  });

  it("traduit 422 en code invalide et 423 en confirmation requise à l’activation", async () => {
    expect(await setup([validation({ code: ["Code invalide."] })]).source.enableTwoFactor("000000")).toEqual({ status: "invalid_code" });
    expect(await setup([passwordRequired()]).source.enableTwoFactor("123456")).toEqual({ status: "confirmation_required", needsCode: false });
    await expect(setup([problem(429, "too_many_requests", { retryAfter: 60 })]).source.enableTwoFactor("123456")).rejects.toMatchObject({
      status: 429,
    });
  });

  it("désactive la 2FA", async () => {
    const { source, call } = setup([emptyJson(200)]);

    expect(await source.disableTwoFactor()).toEqual({ status: "ok" });
    expect(call(0).method).toBe("DELETE");
    expect(call(0).url.pathname).toBe("/auth/user/two-factor-authentication");
  });

  it("régénère les codes de secours puis les relit", async () => {
    const { source, call } = setup([emptyJson(200), json(200, api.recoveryCodesResponse)]);

    expect(await source.regenerateBackupCodes()).toEqual({ status: "ok", backupCodes: api.recoveryCodesResponse });
    expect(call(0).method).toBe("POST");
    expect(call(0).url.pathname).toBe("/auth/user/two-factor-recovery-codes");
    expect(call(1).method).toBe("GET");
  });

  it("traduit 423 en confirmation requise, propage 401 et refuse une liste de codes vide", async () => {
    expect(await setup([passwordRequired()]).source.disableTwoFactor()).toEqual({ status: "confirmation_required", needsCode: false });
    expect(await setup([passwordRequired()]).source.regenerateBackupCodes()).toEqual({ status: "confirmation_required", needsCode: false });
    await expect(setup([problem(401, "unauthenticated")]).source.disableTwoFactor()).rejects.toMatchObject({ status: 401 });
    await expect(setup([emptyJson(200), json(200, [])]).source.regenerateBackupCodes()).rejects.toThrow("Réponse inattendue");
  });
});

describe("source API : preuve 2FA exigée pour gérer le second facteur", () => {
  it("traduit 403 reauthentication_required en demande de code pour la désactivation et la régénération", async () => {
    expect(await setup([reauthRequired()]).source.disableTwoFactor()).toEqual({ status: "confirmation_required", needsCode: true });
    expect(await setup([reauthRequired()]).source.regenerateBackupCodes()).toEqual({ status: "confirmation_required", needsCode: true });
  });

  it("propage un 403 d’un autre motif et le 409 two_factor_already_enabled", async () => {
    await expect(setup([problem(403, "forbidden")]).source.disableTwoFactor()).rejects.toMatchObject({ status: 403 });
    await expect(setup([problem(409, "two_factor_already_enabled")]).source.disableTwoFactor()).rejects.toMatchObject({ status: 409 });
  });
});

describe("source API : suppression du compte", () => {
  it("supprime le compte quand la session est confirmée récemment", async () => {
    const { source, call } = setup([noContent()]);

    expect(await source.deleteAccount()).toEqual({ status: "deleted" });
    expect(call(0).method).toBe("DELETE");
    expect(call(0).url.pathname).toBe("/api/v1/me");
  });

  it("demande une confirmation par mot de passe quand rien n’indique de 2FA (403 reauthentication_required)", async () => {
    expect(await setup([reauthRequired()]).source.deleteAccount()).toEqual({ status: "confirmation_required", needsCode: false });
  });

  it("demande un code quand la connexion a révélé la 2FA", async () => {
    const { source } = setup([json(200, api.loginTwoFactorResponse), noContent(), reauthRequired()]);

    await source.signIn({ email: "jeanne@exemple.fr", password: "Motdepasse1" });
    await source.verifyTwoFactor("123456");
    expect(await source.deleteAccount()).toEqual({ status: "confirmation_required", needsCode: true });
  });

  it("redemande un code quand le mot de passe vient d’être confirmé et que le serveur refuse encore", async () => {
    let clock = new Date("2026-11-15T10:00:00.000Z");
    const { source } = setup([emptyJson(201), reauthRequired(), reauthRequired()], () => clock);

    await source.confirmPassword("Motdepasse1");
    expect(await source.deleteAccount()).toEqual({ status: "confirmation_required", needsCode: true });
    clock = new Date("2026-11-15T10:06:00.000Z");
    expect(await source.deleteAccount()).toEqual({ status: "confirmation_required", needsCode: false });
  });

  it("ne confond pas les autres refus avec une confirmation : 403 sans code, 401 et 429 sont propagés", async () => {
    await expect(setup([problem(403, "forbidden")]).source.deleteAccount()).rejects.toMatchObject({ status: 403 });
    await expect(setup([problem(401, "unauthenticated")]).source.deleteAccount()).rejects.toMatchObject({ status: 401 });
    await expect(setup([problem(429, "too_many_requests", { retryAfter: 60 })]).source.deleteAccount()).rejects.toMatchObject({ status: 429 });
  });
});

describe("source API : fonctions sans équivalent serveur", () => {
  it("rejettent une erreur explicite sans aucun appel réseau", async () => {
    const { source, fetchImpl } = setup([]);

    await expect(source.changeEmail("nouvelle@exemple.fr")).rejects.toThrow(UNAVAILABLE_MESSAGE);
    await expect(source.linkProvider({ provider: "google", identityId: "x" })).rejects.toThrow(UNAVAILABLE_MESSAGE);
    await expect(source.unlinkProvider("google")).rejects.toThrow(UNAVAILABLE_MESSAGE);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
