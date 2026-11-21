import { ApiError } from "@eguardimmo/api";
import { describe, expect, it } from "vitest";
import { tenantInvitationPreviewSchema } from "../schemas";
import * as api from "./responses.fixtures";
import { json, problem, setup, validation } from "./testing";

const PREVIEW = "/api/v1/tenant-invitations/preview";
const ACCEPTANCE = "/api/v1/tenant-invitations/acceptance";
const accept = { token: api.TENANT_TOKEN, consent: true } as const;

describe("source API : aperçu d’une invitation locataire", () => {
  it("lit l’organisation et l’expiration depuis la ressource du serveur", async () => {
    const { source, call } = setup([json(200, api.tenantInvitationPreviewResponse)]);

    const result = tenantInvitationPreviewSchema.parse(await source.previewTenantInvitation(api.TENANT_TOKEN));

    expect(result).toEqual({ status: "valid", organizationName: "Agence du Port", expiresAt: "2026-11-23T10:00:00.000Z" });
    expect(call(0).url.pathname).toBe(PREVIEW);
    expect(call(0).method).toBe("POST");
    expect(call(0).body).toEqual({ token: api.TENANT_TOKEN });
  });

  it.each([
    ["un jeton inconnu, expiré ou utilisé (404)", problem(404, "tenant_invitation_invalid"), { status: "invalid" }],
    ["un jeton mal formé (422 sur token)", validation({ token: ["Le champ token doit contenir 48 caractères."] }), { status: "invalid" }],
    ["une adresse différente (403)", problem(403, "tenant_invitation_email_mismatch"), { status: "email_mismatch" }],
    ["une adresse non vérifiée (403)", problem(403, "email_unverified"), { status: "email_unverified" }],
    ["l’absence de session (401)", problem(401, "unauthenticated"), { status: "unauthenticated" }],
    ["la limitation de débit (429)", problem(429, "too_many_requests", { retryAfter: 42 }), { status: "rate_limited", retryAfterSeconds: 42 }],
  ])("traduit %s", async (_label, response, expected) => {
    const { source } = setup([response]);
    expect(await source.previewTenantInvitation(api.TENANT_TOKEN)).toEqual(expected);
  });

  it("applique 60 s quand le 429 n’indique pas Retry-After", async () => {
    const { source } = setup([json(429, { code: "too_many_requests" })]);
    expect(await source.previewTenantInvitation(api.TENANT_TOKEN)).toEqual({ status: "rate_limited", retryAfterSeconds: 60 });
  });

  it.each([
    ["une panne serveur", problem(500, "server_error")],
    ["un 404 qui n’est pas l’invitation", problem(404, "not_found")],
    ["un 403 d’un autre motif", problem(403, "operator_token_forbidden")],
  ])("propage %s au lieu de la présenter comme une invitation invalide", async (_label, response) => {
    await expect(setup([response]).source.previewTenantInvitation(api.TENANT_TOKEN)).rejects.toBeInstanceOf(ApiError);
  });

  it("refuse une réponse mal formée", async () => {
    await expect(setup([json(200, { data: {} })]).source.previewTenantInvitation(api.TENANT_TOKEN)).rejects.toThrow("Réponse inattendue");
  });
});

describe("source API : acceptation d’une invitation locataire", () => {
  it("envoie le jeton et le consentement puis confirme le rattachement", async () => {
    const { source, call } = setup([json(201, api.tenantInvitationAcceptanceResponse)]);

    expect(await source.acceptTenantInvitation(accept)).toEqual({ status: "accepted" });
    expect(call(0).url.pathname).toBe(ACCEPTANCE);
    expect(call(0).method).toBe("POST");
    expect(call(0).body).toEqual({ token: api.TENANT_TOKEN, consent: true });
  });

  it.each([
    ["un jeton invalide (404)", problem(404, "tenant_invitation_invalid"), { status: "invalid" }],
    ["une adresse différente (403)", problem(403, "tenant_invitation_email_mismatch"), { status: "email_mismatch" }],
    ["une adresse non vérifiée (403)", problem(403, "email_unverified"), { status: "email_unverified" }],
    ["l’absence de session (401)", problem(401, "unauthenticated"), { status: "unauthenticated" }],
    ["le consentement manquant (422, code métier)", problem(422, "tenant_invitation_consent_required"), { status: "consent_required" }],
    ["le consentement manquant (422, champ)", validation({ consent: ["Le champ consent doit être accepté."] }), { status: "consent_required" }],
    ["un compte déjà rattaché dans l’organisation (409)", problem(409, "tenant_account_already_linked"), { status: "account_already_linked" }],
    ["une fiche déjà rattachée (409)", problem(409, "party_already_linked"), { status: "party_already_linked" }],
    ["la limitation de débit (429)", problem(429, "too_many_requests", { retryAfter: 30 }), { status: "rate_limited", retryAfterSeconds: 30 }],
  ])("traduit %s", async (_label, response, expected) => {
    const { source } = setup([response]);
    expect(await source.acceptTenantInvitation(accept)).toEqual(expected);
  });

  it.each([
    ["une panne serveur", problem(500, "server_error")],
    ["un 409 d’un autre motif", problem(409, "version_conflict")],
    ["un 403 d’un autre motif", problem(403, "operator_token_forbidden")],
  ])("propage %s sans l’avaler", async (_label, response) => {
    await expect(setup([response]).source.acceptTenantInvitation(accept)).rejects.toBeInstanceOf(ApiError);
  });

  it("ne confirme pas un rattachement quand la réponse 201 est inexploitable", async () => {
    await expect(setup([json(201, { data: {} })]).source.acceptTenantInvitation(accept)).rejects.toThrow("Réponse inattendue");
  });
});
