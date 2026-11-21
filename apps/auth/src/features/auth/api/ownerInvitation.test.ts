import { ApiError } from "@eguardimmo/api";
import { describe, expect, it } from "vitest";
import { ownerInvitationPreviewSchema } from "../ownerInvitationSchemas";
import * as api from "./responses.fixtures";
import { json, problem, setup, validation } from "./testing";

const PREVIEW = "/api/v1/owner-invitations/preview";
const ACCEPTANCE = "/api/v1/owner-invitations/acceptance";
const accept = { token: api.OWNER_TOKEN, code: api.OWNER_CODE, consent: true } as const;

describe("source API : aperçu d’une invitation propriétaire", () => {
  it("lit l’agence, le rôle et l’expiration depuis la ressource du serveur", async () => {
    const { source, call } = setup([json(200, api.ownerInvitationPreviewResponse)]);

    const result = ownerInvitationPreviewSchema.parse(await source.previewOwnerInvitation(api.OWNER_TOKEN));

    expect(result).toEqual({ status: "valid", organizationName: "Agence du Port", role: "holder", expiresAt: "2026-11-26T10:00:00.000Z" });
    expect(call(0).url.pathname).toBe(PREVIEW);
    expect(call(0).method).toBe("POST");
    expect(call(0).body).toEqual({ token: api.OWNER_TOKEN });
  });

  it.each([
    ["un jeton inconnu, expiré, utilisé ou bloqué (404)", problem(404, "owner_invitation_invalid"), { status: "invalid" }],
    ["un jeton mal formé (422 sur token)", validation({ token: ["Le champ token doit contenir 48 caractères."] }), { status: "invalid" }],
    ["une adresse différente (403)", problem(403, "owner_invitation_email_mismatch"), { status: "email_mismatch" }],
    ["une adresse non vérifiée (403)", problem(403, "email_unverified"), { status: "email_unverified" }],
    ["l’absence de session (401)", problem(401, "unauthenticated"), { status: "unauthenticated" }],
    ["la limitation de débit (429)", problem(429, "too_many_requests", { retryAfter: 42 }), { status: "rate_limited", retryAfterSeconds: 42 }],
  ])("traduit %s", async (_label, response, expected) => {
    const { source } = setup([response]);
    expect(await source.previewOwnerInvitation(api.OWNER_TOKEN)).toEqual(expected);
  });

  it("applique 60 s quand le 429 n’indique pas Retry-After", async () => {
    const { source } = setup([json(429, { code: "too_many_requests" })]);
    expect(await source.previewOwnerInvitation(api.OWNER_TOKEN)).toEqual({ status: "rate_limited", retryAfterSeconds: 60 });
  });

  it.each([
    ["une panne serveur", problem(500, "server_error")],
    ["un 404 qui n’est pas l’invitation", problem(404, "not_found")],
    ["un 403 space_forbidden", problem(403, "space_forbidden")],
    ["un code inconnu", problem(409, "code_inconnu_du_futur")],
  ])("propage %s au lieu de la présenter comme une invitation invalide", async (_label, response) => {
    await expect(setup([response]).source.previewOwnerInvitation(api.OWNER_TOKEN)).rejects.toBeInstanceOf(ApiError);
  });

  it("refuse une réponse mal formée", async () => {
    await expect(setup([json(200, { data: {} })]).source.previewOwnerInvitation(api.OWNER_TOKEN)).rejects.toThrow("Réponse inattendue");
  });
});

describe("source API : acceptation d’une invitation propriétaire", () => {
  it("envoie le jeton, le code et le consentement puis confirme le rattachement", async () => {
    const { source, call } = setup([json(201, api.ownerInvitationAcceptanceResponse)]);

    expect(await source.acceptOwnerInvitation(accept)).toEqual({ status: "accepted", role: "holder" });
    expect(call(0).url.pathname).toBe(ACCEPTANCE);
    expect(call(0).method).toBe("POST");
    expect(call(0).body).toEqual({ token: api.OWNER_TOKEN, code: api.OWNER_CODE, consent: true });
  });

  it("accepte un nom d’agence absent dans la réponse", async () => {
    const response = { data: { ...api.ownerInvitationAcceptanceResponse.data, organization: { id: "0199a1b2-7c3d-7e4f-8a5b-9a8b7c6d5e4f", name: null } } };
    expect(await setup([json(201, response)]).source.acceptOwnerInvitation(accept)).toEqual({ status: "accepted", role: "holder" });
  });

  it.each([
    ["un jeton invalide (404)", problem(404, "owner_invitation_invalid"), { status: "invalid" }],
    ["une adresse différente (403)", problem(403, "owner_invitation_email_mismatch"), { status: "email_mismatch" }],
    ["une adresse non vérifiée (403)", problem(403, "email_unverified"), { status: "email_unverified" }],
    ["l’absence de session (401)", problem(401, "unauthenticated"), { status: "unauthenticated" }],
    ["le consentement manquant (422, code métier)", problem(422, "owner_invitation_consent_required"), { status: "consent_required" }],
    ["le consentement manquant (422, champ)", validation({ consent: ["Le champ consent doit être accepté."] }), { status: "consent_required" }],
    ["un code faux (422, code métier)", problem(422, "owner_invitation_code_invalid"), { status: "code_invalid" }],
    ["un code mal formé (422, champ)", validation({ code: ["Le champ code doit contenir 6 chiffres."] }), { status: "code_invalid" }],
    ["un accès déjà accordé (409)", problem(409, "owner_access_already_linked"), { status: "already_linked" }],
    ["le plafond d’accès atteint (409)", problem(409, "owner_access_limit_reached"), { status: "limit_reached" }],
    ["la limitation de débit (429)", problem(429, "too_many_requests", { retryAfter: 30 }), { status: "rate_limited", retryAfterSeconds: 30 }],
  ])("traduit %s", async (_label, response, expected) => {
    const { source } = setup([response]);
    expect(await source.acceptOwnerInvitation(accept)).toEqual(expected);
  });

  it.each([
    ["une panne serveur", problem(500, "server_error")],
    ["un 409 d’un autre motif", problem(409, "version_conflict")],
    ["un 403 space_forbidden", problem(403, "space_forbidden")],
  ])("propage %s sans l’avaler", async (_label, response) => {
    await expect(setup([response]).source.acceptOwnerInvitation(accept)).rejects.toBeInstanceOf(ApiError);
  });

  it("ne confirme pas un rattachement quand la réponse 201 est inexploitable", async () => {
    await expect(setup([json(201, { data: {} })]).source.acceptOwnerInvitation(accept)).rejects.toThrow("Réponse inattendue");
  });

  it("ne met jamais le code dans l’URL ni dans les paramètres de requête", async () => {
    const { source, call } = setup([json(201, api.ownerInvitationAcceptanceResponse)]);
    await source.acceptOwnerInvitation(accept);
    expect(call(0).url.toString()).not.toContain(api.OWNER_CODE);
    expect(call(0).url.toString()).not.toContain(api.OWNER_TOKEN);
  });
});
