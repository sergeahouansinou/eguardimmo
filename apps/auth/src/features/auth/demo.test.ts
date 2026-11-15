import { describe, expect, it } from "vitest";
import { DEMO_PASSWORD, DEMO_TOTP_CODE } from "./demoData";
import { sessionSchema } from "./schemas";
import { createTestEnvironment } from "../../../test/render";

const KOFFI = "koffi.adjovi@example.com";
const MARC = "marc.chevalier@example.com";

describe("démo : connexion", () => {
  it("ouvre une session avec des identifiants corrects et sans 2FA", async () => {
    const { source, store } = createTestEnvironment();
    expect(await source.signIn({ email: MARC, password: DEMO_PASSWORD })).toEqual({ status: "authenticated" });
    expect(store.read()).toBe("marc");
    expect(sessionSchema.parse(await source.getSession()).firstName).toBe("Marc");
  });

  it("répond de la même façon pour un compte inconnu et un mauvais mot de passe", async () => {
    const { source, store } = createTestEnvironment();
    const unknown = await source.signIn({ email: "inconnu@example.com", password: "nimportequoi" });
    const wrong = await source.signIn({ email: MARC, password: "mauvais" });
    expect(unknown).toEqual({ status: "invalid_credentials" });
    expect(wrong).toEqual(unknown);
    expect(store.read()).toBeNull();
  });

  it("verrouille 14 minutes après 5 échecs, même avec le bon mot de passe, puis libère", async () => {
    const { source, advance } = createTestEnvironment();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect(await source.signIn({ email: MARC, password: "mauvais" })).toEqual({ status: "invalid_credentials" });
    }
    expect(await source.signIn({ email: MARC, password: "mauvais" })).toEqual({ status: "locked", retryAfterSeconds: 840 });
    expect(await source.signIn({ email: MARC, password: DEMO_PASSWORD })).toMatchObject({ status: "locked" });
    advance(841);
    expect(await source.signIn({ email: MARC, password: DEMO_PASSWORD })).toEqual({ status: "authenticated" });
  });

  it("verrouille aussi une adresse inconnue (aucune énumération)", async () => {
    const { source } = createTestEnvironment();
    for (let attempt = 0; attempt < 4; attempt += 1) await source.signIn({ email: "x@example.com", password: "a" });
    expect(await source.signIn({ email: "x@example.com", password: "a" })).toMatchObject({ status: "locked" });
  });

  it("exige la 2FA, refuse un mauvais code, verrouille après 5 essais et accepte le bon code", async () => {
    const { source, store, advance } = createTestEnvironment();
    expect(await source.signIn({ email: KOFFI, password: DEMO_PASSWORD })).toEqual({ status: "two_factor_required" });
    expect(store.read()).toBeNull();
    for (let attempt = 0; attempt < 4; attempt += 1) expect(await source.verifyTwoFactor("000000")).toEqual({ status: "invalid_code" });
    expect(await source.verifyTwoFactor("000000")).toEqual({ status: "invalid_code" });
    expect(await source.verifyTwoFactor(DEMO_TOTP_CODE)).toEqual({ status: "locked", retryAfterSeconds: 60 });
    advance(61);
    expect(await source.verifyTwoFactor(DEMO_TOTP_CODE)).toEqual({ status: "authenticated" });
    expect(store.read()).toBe("koffi");
  });

  it("signale un défi 2FA expiré quand il n’y en a pas", async () => {
    const { source } = createTestEnvironment();
    expect(await source.verifyTwoFactor(DEMO_TOTP_CODE)).toEqual({ status: "challenge_expired" });
  });

  it("consomme un code de secours une seule fois", async () => {
    const { source } = createTestEnvironment();
    await source.signIn({ email: KOFFI, password: DEMO_PASSWORD });
    expect(await source.verifyBackupCode("r5n7v-4bj2e")).toEqual({ status: "authenticated" });
    await source.signOut();
    await source.signIn({ email: KOFFI, password: DEMO_PASSWORD });
    expect(await source.verifyBackupCode("r5n7v-4bj2e")).toEqual({ status: "invalid_code" });
  });
});

describe("démo : connexion sociale", () => {
  it.each([
    ["koffi-google", "connexion", "two_factor_required"],
    ["camille-google", "connexion", "authenticated"],
    ["marc-meme-email", "connexion", "link_required"],
    ["nouveau-client", "connexion", "account_not_found"],
    ["nouveau-client", "inscription", "authenticated"],
  ] as const)("%s en %s donne %s", async (identityId, intent, expected) => {
    const { source } = createTestEnvironment();
    expect((await source.socialSignIn({ provider: "google", intent, identityId })).status).toBe(expected);
  });
});

describe("démo : mots de passe et inscription", () => {
  it("répond identiquement à la demande de réinitialisation, limite à 5 par minute", async () => {
    const { source } = createTestEnvironment();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await source.requestPasswordReset(attempt % 2 === 0 ? MARC : "inconnu@example.com")).toEqual({ status: "sent" });
    }
    expect(await source.requestPasswordReset(MARC)).toMatchObject({ status: "rate_limited" });
  });

  it("réinitialise le mot de passe avec un jeton valide et refuse l’ancien mot de passe", async () => {
    const { source, store } = createTestEnvironment("marc");
    await source.requestPasswordReset(MARC);
    expect(await source.resetPassword({ token: "expire", email: "", password: "Nouveau-Mot-2026" })).toEqual({ status: "expired" });
    expect(await source.resetPassword({ token: "valide", email: "", password: DEMO_PASSWORD })).toEqual({ status: "reused" });
    expect(await source.resetPassword({ token: "valide", email: "", password: "Nouveau-Mot-2026" })).toEqual({ status: "ok" });
    expect(store.read()).toBeNull();
    expect(await source.signIn({ email: MARC, password: "Nouveau-Mot-2026" })).toEqual({ status: "authenticated" });
  });

  it("crée un compte à l’inscription, sans rien révéler pour une adresse existante", async () => {
    const { source, store } = createTestEnvironment();
    const input = { profile: "bailleur", firstName: "Léa", lastName: "Martin", email: "lea@example.com", password: "Mot-De-Passe-2026" } as const;
    expect(await source.register(input)).toEqual({ status: "sent" });
    expect(store.read()).not.toBeNull();
    await source.signOut();
    expect(await source.register({ ...input, email: MARC })).toEqual({ status: "sent" });
    expect(store.read()).toBeNull();
  });

  it("limite le renvoi du message de vérification à une fois par minute", async () => {
    const { source, advance } = createTestEnvironment();
    await source.register({ profile: "voyageur", firstName: "A", lastName: "B", email: "a@example.com", password: "Mot-De-Passe-2026" });
    expect(await source.getVerificationStatus()).toEqual({ resendAvailableInSeconds: 60 });
    expect(await source.resendVerification()).toMatchObject({ status: "rate_limited" });
    advance(61);
    expect(await source.resendVerification()).toEqual({ status: "sent" });
  });

  it("n’active une invitation qu’une seule fois", async () => {
    const { source } = createTestEnvironment();
    expect(await source.getInvitation("locataire-koffi")).toMatchObject({ status: "valid" });
    expect(await source.acceptInvitation({ token: "locataire-koffi", password: "Mot-De-Passe-2026" })).toEqual({ status: "activated" });
    expect(await source.getInvitation("locataire-koffi")).toEqual({ status: "invalid" });
    expect(await source.getInvitation("inconnue")).toEqual({ status: "invalid" });
  });
});

describe("démo : actions sensibles", () => {
  it("exige une confirmation récente, expirée après 5 minutes", async () => {
    const { source, advance } = createTestEnvironment("marc");
    expect(await source.disableTwoFactor()).toEqual({ status: "confirmation_required", needsCode: false });
    expect(await source.confirmPassword("mauvais")).toEqual({ status: "invalid" });
    expect(await source.confirmPassword(DEMO_PASSWORD)).toEqual({ status: "confirmed" });
    expect(await source.disableTwoFactor()).toEqual({ status: "ok" });
    advance(301);
    expect(await source.disableTwoFactor()).toEqual({ status: "confirmation_required", needsCode: false });
  });

  it("active la 2FA avec un bon code et remet des codes de secours", async () => {
    const { source } = createTestEnvironment("marc");
    await source.confirmPassword(DEMO_PASSWORD);
    expect(await source.enableTwoFactor("000000")).toEqual({ status: "invalid_code" });
    const result = await source.enableTwoFactor(DEMO_TOTP_CODE);
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.backupCodes).toHaveLength(8);
  });

  it("exige un code 2FA pour supprimer un compte protégé, puis anonymise", async () => {
    const { source, store } = createTestEnvironment("koffi");
    await source.confirmPassword(DEMO_PASSWORD);
    expect(await source.deleteAccount()).toEqual({ status: "confirmation_required", needsCode: true });
    await source.signIn({ email: KOFFI, password: DEMO_PASSWORD });
    await source.verifyTwoFactor(DEMO_TOTP_CODE);
    expect(await source.confirmCode(DEMO_TOTP_CODE)).toEqual({ status: "confirmed" });
    expect(await source.deleteAccount()).toEqual({ status: "deleted" });
    expect(store.read()).toBeNull();
    expect(await source.signIn({ email: KOFFI, password: DEMO_PASSWORD })).toEqual({ status: "invalid_credentials" });
  });

  it("exige une confirmation avant de délier un compte social", async () => {
    const { source } = createTestEnvironment("camille");
    expect(await source.unlinkProvider("google")).toEqual({ status: "confirmation_required", needsCode: false });
  });

  it("refuse de lier une identité déjà rattachée à un autre compte", async () => {
    const { source } = createTestEnvironment("marc");
    await source.confirmPassword(DEMO_PASSWORD);
    expect(await source.linkProvider({ provider: "google", identityId: "koffi-google" })).toEqual({ status: "conflict" });
    expect(await source.linkProvider({ provider: "google", identityId: "nouveau-client" })).toEqual({ status: "ok" });
  });

  it("déconnecte un appareil ou tous les autres, jamais l’appareil courant", async () => {
    const { source } = createTestEnvironment("koffi");
    await source.signOutDevice("Koffi-safari");
    const before = (await source.getSecurity()) as { devices: { id: string; current: boolean }[] };
    expect(before.devices.map((device) => device.id)).toContain("Koffi-safari");
    await source.signOutOtherDevices();
    const after = (await source.getSecurity()) as { devices: { current: boolean }[] };
    expect(after.devices).toHaveLength(1);
    expect(after.devices[0]?.current).toBe(true);
  });
});
