import { describe, expect, it } from "vitest";
import * as api from "./responses.fixtures";
import { UNAVAILABLE_MESSAGE } from "./index";
import { emptyJson, noContent, problem, setup, validation } from "./testing";

const bailleur = {
  profile: "bailleur",
  firstName: "Jeanne",
  lastName: "Martin",
  email: "jeanne@exemple.fr",
  password: "Motdepasse1",
} as const;

describe("source API : inscription et vérification de l’e-mail", () => {
  it("inscrit un bailleur avec le profil attendu par le serveur", async () => {
    const { source, call } = setup([emptyJson(202)]);

    expect(await source.register(bailleur)).toEqual({ status: "sent" });
    expect(call(0).url.pathname).toBe("/auth/register");
    expect(call(0).body).toEqual({
      name: "Jeanne Martin",
      email: "jeanne@exemple.fr",
      password: "Motdepasse1",
      password_confirmation: "Motdepasse1",
      intended_profile: "individual_landlord",
    });
  });

  it("inscrit une agence (nom de l’agence) et un voyageur", async () => {
    const agence = setup([emptyJson(202)]);
    await agence.source.register({ profile: "agence", agencyName: "Agence Les Tilleuls", siren: "123 456 789", email: "a@exemple.fr", password: "Motdepasse1" });
    expect(agence.call(0).body).toMatchObject({ name: "Agence Les Tilleuls", intended_profile: "agency" });
    expect(JSON.stringify(agence.call(0).body)).not.toContain("123 456 789");

    const voyageur = setup([emptyJson(202)]);
    await voyageur.source.register({ ...bailleur, profile: "voyageur" });
    expect(voyageur.call(0).body).toMatchObject({ intended_profile: "traveler" });
  });

  it("traduit 429 en limitation de débit et propage 422 avec ses erreurs de champ", async () => {
    expect(await setup([problem(429, "too_many_requests", { retryAfter: 30 })]).source.register(bailleur)).toEqual({
      status: "rate_limited",
      retryAfterSeconds: 30,
    });
    await expect(setup([validation({ email: ["Adresse invalide."] })]).source.register(bailleur)).rejects.toMatchObject({
      status: 422,
      fieldErrors: { email: ["Adresse invalide."] },
    });
  });

  it("renvoie l’e-mail de vérification pour la session ouverte", async () => {
    const { source, call } = setup([emptyJson(202)]);

    expect(await source.resendVerification()).toEqual({ status: "sent" });
    expect(call(0).url.pathname).toBe("/auth/email/verification-notification");
  });

  it("signale 429, refuse sans session (401) et n’annonce pas un envoi quand l’adresse est déjà vérifiée (204)", async () => {
    expect(await setup([problem(429, "too_many_requests", { retryAfter: 45 })]).source.resendVerification()).toEqual({
      status: "rate_limited",
      retryAfterSeconds: 45,
    });
    await expect(setup([problem(401, "unauthenticated")]).source.resendVerification()).rejects.toMatchObject({ status: 401 });
    await expect(setup([noContent()]).source.resendVerification()).rejects.toThrow("déjà confirmée");
  });

  it("confirme l’adresse en appelant le lien signé tel qu’émis par le serveur", async () => {
    const { source, call } = setup([noContent()]);

    expect(await source.verifyEmail(api.SIGNED_VERIFY_URL)).toEqual({ status: "verified" });
    expect(call(0).url.pathname).toBe(`/auth/email/verify/${api.IDS.user}/da39a3ee5e6b4b0d3255bfef95601890afd80709`);
    expect(call(0).url.search).toBe(new URL(api.SIGNED_VERIFY_URL).search);
    expect(call(0).method).toBe("GET");
  });

  it("traduit 403 (lien expiré ou altéré) en lien expiré et propage 401", async () => {
    expect(await setup([problem(403, "forbidden")]).source.verifyEmail(api.SIGNED_VERIFY_URL)).toEqual({ status: "expired" });
    await expect(setup([problem(401, "unauthenticated")]).source.verifyEmail(api.SIGNED_VERIFY_URL)).rejects.toMatchObject({ status: 401 });
  });

  it.each([
    ["un jeton quelconque", "abc123"],
    ["un hôte étranger", api.SIGNED_VERIFY_URL.replace("api.test", "pirate.test")],
    ["un autre chemin de l’API", "https://api.test/api/v1/me?expires=1&signature=2"],
  ])("refuse sans appel réseau %s", async (_label, link) => {
    const { source, fetchImpl } = setup([]);

    expect(await source.verifyEmail(link)).toEqual({ status: "expired" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("n’expose ni statut de renvoi ni invitation : erreur explicite sans appel réseau", async () => {
    const { source, fetchImpl } = setup([]);

    await expect(source.getVerificationStatus()).rejects.toThrow(UNAVAILABLE_MESSAGE);
    await expect(source.getInvitation("jeton")).rejects.toThrow(UNAVAILABLE_MESSAGE);
    await expect(source.acceptInvitation({ token: "jeton", password: "Motdepasse1" })).rejects.toThrow(UNAVAILABLE_MESSAGE);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
