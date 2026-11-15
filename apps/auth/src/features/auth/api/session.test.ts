import { describe, expect, it } from "vitest";
import { profileSchema, sessionSchema } from "../schemas";
import * as api from "./responses.fixtures";
import { UNAVAILABLE_MESSAGE } from "./index";
import { json, noContent, problem, setup, validation } from "./testing";

describe("source API : session", () => {
  it("renvoie la session de l’utilisateur courant en séparant prénom et nom", async () => {
    const { source, call } = setup([json(200, api.meResponse)]);

    expect(sessionSchema.parse(await source.getSession())).toEqual({
      userId: api.IDS.user,
      firstName: "Jeanne",
      lastName: "Martin",
      email: "jeanne@exemple.fr",
    });
    expect(call(0).url.pathname).toBe("/api/v1/me");
    expect(call(0).method).toBe("GET");
  });

  it("accepte un nom sans espace et un nom composé", async () => {
    const single = setup([json(200, { data: { ...api.meResponse.data, name: "Madonna" } })]);
    const composed = setup([json(200, { data: { ...api.meResponse.data, name: "Jean de la Fontaine" } })]);

    expect(sessionSchema.parse(await single.source.getSession())).toMatchObject({ firstName: "Madonna", lastName: "" });
    expect(sessionSchema.parse(await composed.source.getSession())).toMatchObject({ firstName: "Jean", lastName: "de la Fontaine" });
  });

  it("renvoie null sans session (401) et propage les autres erreurs", async () => {
    expect(await setup([problem(401, "unauthenticated")]).source.getSession()).toBeNull();
    await expect(setup([problem(500, "server_error")]).source.getSession()).rejects.toMatchObject({ status: 500 });
    await expect(setup([json(200, { data: {} })]).source.getSession()).rejects.toThrow("Réponse inattendue");
  });

  it("ouvre la session avec e-mail et mot de passe", async () => {
    const { source, call } = setup([json(200, api.loginResponse)]);

    expect(await source.signIn({ email: "jeanne@exemple.fr", password: "Motdepasse1" })).toEqual({ status: "authenticated" });
    expect(call(0).url.pathname).toBe("/auth/login");
    expect(call(0).method).toBe("POST");
    expect(call(0).body).toEqual({ email: "jeanne@exemple.fr", password: "Motdepasse1" });
  });

  it("demande le défi 2FA quand le serveur l’exige", async () => {
    const { source } = setup([json(200, api.loginTwoFactorResponse)]);
    expect(await source.signIn({ email: "jeanne@exemple.fr", password: "Motdepasse1" })).toEqual({ status: "two_factor_required" });
  });

  it("traduit 422 en identifiants invalides, sans distinguer compte inconnu et mauvais mot de passe", async () => {
    const { source } = setup([validation({ email: ["Ces identifiants ne correspondent pas à nos enregistrements."] })]);
    expect(await source.signIn({ email: "jeanne@exemple.fr", password: "faux" })).toEqual({ status: "invalid_credentials" });
  });

  it("traduit 429 en verrouillage avec le délai de l’en-tête Retry-After", async () => {
    const { source } = setup([problem(429, "too_many_requests", { retryAfter: 900 })]);
    expect(await source.signIn({ email: "jeanne@exemple.fr", password: "x" })).toEqual({ status: "locked", retryAfterSeconds: 900 });
  });

  it("applique un délai de 60 s quand le 429 n’indique pas Retry-After", async () => {
    const { source } = setup([json(429, { code: "too_many_requests" })]);
    expect(await source.signIn({ email: "jeanne@exemple.fr", password: "x" })).toEqual({ status: "locked", retryAfterSeconds: 60 });
  });

  it("propage une panne serveur au lieu de la présenter comme des identifiants invalides", async () => {
    const { source } = setup([problem(500, "server_error")]);
    await expect(source.signIn({ email: "jeanne@exemple.fr", password: "x" })).rejects.toMatchObject({ status: 500 });
  });

  it("valide le code TOTP du défi", async () => {
    const { source, call } = setup([noContent()]);

    expect(await source.verifyTwoFactor("123456")).toEqual({ status: "authenticated" });
    expect(call(0).url.pathname).toBe("/auth/two-factor-challenge");
    expect(call(0).body).toEqual({ code: "123456" });
  });

  it("valide un code de secours avec le champ recovery_code", async () => {
    const { source, call } = setup([noContent()]);

    expect(await source.verifyBackupCode("k3Jx9aQw2L-p0Zr7Tm4Vn")).toEqual({ status: "authenticated" });
    expect(call(0).body).toEqual({ recovery_code: "k3Jx9aQw2L-p0Zr7Tm4Vn" });
  });

  it("traduit 422 en code invalide et 429 en verrouillage pour le TOTP et le code de secours", async () => {
    const invalid = validation({ code: ["Code invalide."] });
    expect(await setup([invalid]).source.verifyTwoFactor("000000")).toEqual({ status: "invalid_code" });
    expect(await setup([validation({ recovery_code: ["Code invalide."] })]).source.verifyBackupCode("faux")).toEqual({ status: "invalid_code" });
    expect(await setup([problem(429, "too_many_requests", { retryAfter: 42 })]).source.verifyTwoFactor("000000")).toEqual({
      status: "locked",
      retryAfterSeconds: 42,
    });
    expect(await setup([problem(429, "too_many_requests", { retryAfter: 7 })]).source.verifyBackupCode("faux")).toEqual({
      status: "locked",
      retryAfterSeconds: 7,
    });
  });

  it("ferme la session, y compris quand elle a déjà expiré (401)", async () => {
    const { source, call } = setup([noContent()]);
    await source.signOut();
    expect(call(0).url.pathname).toBe("/auth/logout");
    expect(call(0).method).toBe("POST");

    await expect(setup([problem(401, "unauthenticated")]).source.signOut()).resolves.toBeUndefined();
    await expect(setup([problem(500, "server_error")]).source.signOut()).rejects.toMatchObject({ status: 500 });
  });

  it("mappe les profils du serveur vers les profils du hub et écarte la console", async () => {
    const { source, call } = setup([json(200, api.profilesResponse)]);
    const profiles = (await source.listProfiles() as unknown[]).map((profile) => profileSchema.parse(profile));

    expect(call(0).url.pathname).toBe("/api/v1/me/profiles");
    expect(profiles.map((profile) => [profile.id, profile.kind, profile.title, profile.subtitle])).toEqual([
      [api.IDS.org, "agence", "Espace agence", "Agence Les Tilleuls"],
      ["0199a1b2-7c3d-7e4f-8a5b-aaaaaaaaaaaa", "bailleur", "Espace bailleur", "Jeanne Martin"],
      ["tenant", "locataire", "Espace locataire", "Résidence du Parc"],
      ["owner", "proprietaire", "Espace propriétaire", "Mandat Les Tilleuls"],
    ]);
    expect(profiles[0]?.summary).toBe("Titulaire du compte");
    expect(profiles.every((profile) => !profile.lastUsed)).toBe(true);
  });

  it("refuse la liste des profils sans session (401) et un profil d’organisation mal formé", async () => {
    await expect(setup([problem(401, "unauthenticated")]).source.listProfiles()).rejects.toMatchObject({ status: 401 });
    await expect(
      setup([json(200, { data: [{ space: "organization", label: "X", meta: {} }] })]).source.listProfiles(),
    ).rejects.toThrow("Réponse inattendue");
  });

  it("laisse la sélection d’un profil au client : aucun appel réseau, la redirection est faite par l’écran", async () => {
    const { source, fetchImpl } = setup([]);

    await expect(source.selectProfile("tenant")).resolves.toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("n’invente aucune identité sociale : appel réseau nul et erreur explicite", async () => {
    const { source, fetchImpl } = setup([]);

    expect(source.kind).toBe("api");
    expect(source.socialIdentities("connexion")).toEqual([]);
    await expect(
      source.socialSignIn({ provider: "google", intent: "connexion", identityId: "x" }),
    ).rejects.toThrow(UNAVAILABLE_MESSAGE);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
