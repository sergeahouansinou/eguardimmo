import { describe, expect, it } from "vitest";
import { MISSING_RESET_EMAIL_MESSAGE, UNAVAILABLE_MESSAGE } from "./index";
import * as api from "./responses.fixtures";
import { json, problem, setup, validation } from "./testing";

describe("source API : mot de passe", () => {
  it("demande un lien de réinitialisation", async () => {
    const { source, call } = setup([json(202, { message: "Si un compte correspond à cette adresse, un e-mail vient de lui être envoyé." })]);

    expect(await source.requestPasswordReset("jeanne@exemple.fr")).toEqual({ status: "sent" });
    expect(call(0).url.pathname).toBe("/auth/forgot-password");
    expect(call(0).body).toEqual({ email: "jeanne@exemple.fr" });
  });

  it("traduit 429 en limitation de débit et propage 422", async () => {
    expect(await setup([problem(429, "too_many_requests", { retryAfter: 60 })]).source.requestPasswordReset("a@exemple.fr")).toEqual({
      status: "rate_limited",
      retryAfterSeconds: 60,
    });
    await expect(setup([validation({ email: ["Adresse invalide."] })]).source.requestPasswordReset("x")).rejects.toMatchObject({
      status: 422,
    });
  });

  it("réinitialise le mot de passe avec jeton, e-mail et confirmation", async () => {
    const { source, call } = setup([json(200, { message: "Votre mot de passe a été réinitialisé." })]);

    expect(await source.resetPassword({ token: "jeton-secret", email: "jeanne@exemple.fr", password: "Nouveau1Mdp" })).toEqual({ status: "ok" });
    expect(call(0).url.pathname).toBe("/auth/reset-password");
    expect(call(0).body).toEqual({
      token: "jeton-secret",
      email: "jeanne@exemple.fr",
      password: "Nouveau1Mdp",
      password_confirmation: "Nouveau1Mdp",
    });
  });

  it("traduit l’erreur 422 sur l’e-mail (jeton invalide) en lien expiré, mais propage une erreur sur le mot de passe", async () => {
    const expired = setup([validation({ email: ["Ce jeton de réinitialisation du mot de passe n’est pas valide."] })]);
    expect(await expired.source.resetPassword({ token: "faux", email: "jeanne@exemple.fr", password: "Nouveau1Mdp" })).toEqual({ status: "expired" });

    const weak = setup([validation({ password: ["Le mot de passe est trop court."] })]);
    await expect(weak.source.resetPassword({ token: "jeton", email: "jeanne@exemple.fr", password: "court" })).rejects.toMatchObject({
      status: 422,
      fieldErrors: { password: ["Le mot de passe est trop court."] },
    });
  });

  it("propage le 429 de la réinitialisation et refuse sans e-mail, sans appel réseau", async () => {
    await expect(
      setup([problem(429, "too_many_requests", { retryAfter: 60 })]).source.resetPassword({ token: "t", email: "a@exemple.fr", password: "Nouveau1Mdp" }),
    ).rejects.toMatchObject({ status: 429, retryAfterSeconds: 60 });

    const { source, fetchImpl } = setup([]);
    await expect(source.resetPassword({ token: "t", email: "", password: "Nouveau1Mdp" })).rejects.toThrow(MISSING_RESET_EMAIL_MESSAGE);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("change le mot de passe de la session", async () => {
    const { source, call } = setup([json(200, "")]);

    expect(await source.changePassword({ current: "Ancien1Mdp", password: "Nouveau1Mdp" })).toEqual({ status: "ok" });
    expect(call(0).url.pathname).toBe("/auth/user/password");
    expect(call(0).method).toBe("PUT");
    expect(call(0).body).toEqual({ current_password: "Ancien1Mdp", password: "Nouveau1Mdp", password_confirmation: "Nouveau1Mdp" });
  });

  it("traduit 422 sur current_password en mot de passe actuel invalide, propage les autres erreurs (422, 401)", async () => {
    expect(
      await setup([validation({ current_password: ["Le mot de passe actuel est incorrect."] })]).source.changePassword({ current: "faux", password: "Nouveau1Mdp" }),
    ).toEqual({ status: "invalid_current" });
    await expect(
      setup([validation({ password: ["Trop court."] })]).source.changePassword({ current: "Ancien1Mdp", password: "x" }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      setup([problem(401, "unauthenticated")]).source.changePassword({ current: "Ancien1Mdp", password: "Nouveau1Mdp" }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("vérifie un jeton de réinitialisation sans le consommer", async () => {
    const valid = setup([json(200, api.resetStatusValid)]);
    expect(await valid.source.checkResetToken({ token: "jeton-secret", email: "jeanne@exemple.fr" })).toEqual({ status: "valid" });
    expect(valid.call(0).url.pathname).toBe("/api/v1/auth/password-reset/status");
    expect(valid.call(0).method).toBe("POST");
    expect(valid.call(0).body).toEqual({ token: "jeton-secret", email: "jeanne@exemple.fr" });

    const expired = setup([json(200, api.resetStatusExpired)]);
    expect(await expired.source.checkResetToken({ token: "faux", email: "jeanne@exemple.fr" })).toEqual({ status: "expired" });
  });

  it("déclare expiré un lien sans jeton ou sans e-mail, sans appel réseau", async () => {
    const { source, fetchImpl } = setup([]);

    expect(await source.checkResetToken({ token: "", email: "jeanne@exemple.fr" })).toEqual({ status: "expired" });
    expect(await source.checkResetToken({ token: "jeton", email: "" })).toEqual({ status: "expired" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("propage 429 et 422 de la vérification de jeton au lieu de les présenter comme un lien expiré", async () => {
    await expect(
      setup([problem(429, "too_many_requests", { retryAfter: 30 })]).source.checkResetToken({ token: "t", email: "a@exemple.fr" }),
    ).rejects.toMatchObject({ status: 429, retryAfterSeconds: 30 });
    await expect(
      setup([validation({ email: ["Champ requis."] })]).source.checkResetToken({ token: "t", email: "a@exemple.fr" }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(setup([json(200, { data: { status: "autre" } })]).source.checkResetToken({ token: "t", email: "a@exemple.fr" })).rejects.toThrow(
      "Réponse inattendue",
    );
  });

  it("n’invente pas la définition de mot de passe : erreur explicite sans appel réseau", async () => {
    const { source, fetchImpl } = setup([]);

    await expect(source.requestPasswordDefinition()).rejects.toThrow(UNAVAILABLE_MESSAGE);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
