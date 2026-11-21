import { describe, expect, it } from "vitest";
import { createTestEnvironment } from "../../../test/render";
import { DEMO_TENANT_TOKENS } from "./demoTenantInvitations";
import { profileSchema, tenantInvitationPreviewSchema } from "./schemas";

const accept = (token: string) => ({ token, consent: true }) as const;

describe("démo : invitation locataire", () => {
  it("n’expose rien sans session", async () => {
    const { source } = createTestEnvironment();
    expect(await source.previewTenantInvitation(DEMO_TENANT_TOKENS.koffi)).toEqual({ status: "unauthenticated" });
    expect(await source.acceptTenantInvitation(accept(DEMO_TENANT_TOKENS.koffi))).toEqual({ status: "unauthenticated" });
  });

  it("montre l’organisation et l’expiration au bon compte", async () => {
    const { source } = createTestEnvironment("koffi");
    const preview = tenantInvitationPreviewSchema.parse(await source.previewTenantInvitation(DEMO_TENANT_TOKENS.koffi));
    expect(preview).toEqual({ status: "valid", organizationName: "Gestion Les Tilleuls", expiresAt: "2026-11-21T10:00:00.000Z" });
  });

  it("refuse un autre compte, un jeton expiré et un jeton inconnu sans les confondre", async () => {
    const { source } = createTestEnvironment("marc");
    expect(await source.previewTenantInvitation(DEMO_TENANT_TOKENS.koffi)).toEqual({ status: "email_mismatch" });
    expect(await source.acceptTenantInvitation(accept(DEMO_TENANT_TOKENS.koffi))).toEqual({ status: "email_mismatch" });
    const koffi = createTestEnvironment("koffi").source;
    expect(await koffi.previewTenantInvitation(DEMO_TENANT_TOKENS.expiree)).toEqual({ status: "invalid" });
    expect(await koffi.previewTenantInvitation("Inconnu".padEnd(48, "0"))).toEqual({ status: "invalid" });
  });

  it("exige une adresse vérifiée avant de regarder le jeton", async () => {
    const { source } = createTestEnvironment();
    await source.register({ profile: "voyageur", firstName: "Nina", lastName: "Roy", email: "nina@example.com", password: "Mot-De-Passe-2026" });
    expect(await source.previewTenantInvitation("Inconnu".padEnd(48, "0"))).toEqual({ status: "email_unverified" });
    expect(await source.acceptTenantInvitation(accept(DEMO_TENANT_TOKENS.koffi))).toEqual({ status: "email_unverified" });
  });

  it("rattache le compte, ajoute le profil locataire et consomme l’invitation", async () => {
    const { source } = createTestEnvironment("sans-profil");
    expect(await source.listProfiles()).toEqual([]);

    expect(await source.acceptTenantInvitation(accept(DEMO_TENANT_TOKENS.alex))).toEqual({ status: "accepted" });

    const profiles = ((await source.listProfiles()) as unknown[]).map((profile) => profileSchema.parse(profile));
    expect(profiles.map((profile) => [profile.kind, profile.subtitle])).toEqual([["locataire", "Cabinet Delmas Immobilier"]]);
    expect(await source.previewTenantInvitation(DEMO_TENANT_TOKENS.alex)).toEqual({ status: "invalid" });
    expect(await source.acceptTenantInvitation(accept(DEMO_TENANT_TOKENS.alex))).toEqual({ status: "invalid" });
  });

  it("refuse le rattachement d’un compte déjà rattaché sans consommer l’invitation", async () => {
    const { source } = createTestEnvironment("marc");
    expect(await source.acceptTenantInvitation(accept(DEMO_TENANT_TOKENS.marc))).toEqual({ status: "account_already_linked" });
    expect(await source.previewTenantInvitation(DEMO_TENANT_TOKENS.marc)).toMatchObject({ status: "valid" });
  });

  it("laisse expirer l’invitation avec l’horloge", async () => {
    const { source, advance } = createTestEnvironment("koffi");
    expect(await source.previewTenantInvitation(DEMO_TENANT_TOKENS.koffi)).toMatchObject({ status: "valid" });
    advance(7 * 86_400 + 1);
    expect(await source.previewTenantInvitation(DEMO_TENANT_TOKENS.koffi)).toEqual({ status: "invalid" });
  });
});
