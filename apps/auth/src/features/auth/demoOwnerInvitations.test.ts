import { describe, expect, it } from "vitest";
import { createTestEnvironment } from "../../../test/render";
import { DEMO_OWNER_CODES, DEMO_OWNER_TOKENS } from "./demoOwnerInvitations";
import { ownerInvitationPreviewSchema } from "./ownerInvitationSchemas";
import { profileSchema } from "./schemas";

const accept = (token: string, code: string) => ({ token, code, consent: true }) as const;
const ALEX = DEMO_OWNER_TOKENS.alex;

describe("démo : invitation propriétaire", () => {
  it("n’expose rien sans session", async () => {
    const { source } = createTestEnvironment();
    expect(await source.previewOwnerInvitation(ALEX)).toEqual({ status: "unauthenticated" });
    expect(await source.acceptOwnerInvitation(accept(ALEX, DEMO_OWNER_CODES.alex))).toEqual({ status: "unauthenticated" });
  });

  it("montre l’agence, le rôle et l’expiration au bon compte", async () => {
    const { source } = createTestEnvironment("sans-profil");
    const preview = ownerInvitationPreviewSchema.parse(await source.previewOwnerInvitation(ALEX));
    expect(preview).toEqual({ status: "valid", organizationName: "Cabinet Delmas Immobilier", role: "holder", expiresAt: "2026-11-21T10:00:00.000Z" });
  });

  it("refuse un autre compte, un jeton expiré et un jeton inconnu sans les confondre", async () => {
    const { source } = createTestEnvironment("koffi");
    expect(await source.previewOwnerInvitation(ALEX)).toEqual({ status: "email_mismatch" });
    const alex = createTestEnvironment("sans-profil").source;
    expect(await alex.previewOwnerInvitation(DEMO_OWNER_TOKENS.expiree)).toEqual({ status: "invalid" });
    expect(await alex.previewOwnerInvitation("Inconnu".padEnd(48, "0"))).toEqual({ status: "invalid" });
  });

  it("refuse un code faux sans consommer l’invitation, puis bloque à la cinquième erreur", async () => {
    const { source } = createTestEnvironment("sans-profil");
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect(await source.acceptOwnerInvitation(accept(ALEX, "000000"))).toEqual({ status: "code_invalid" });
    }
    expect(await source.previewOwnerInvitation(ALEX)).toMatchObject({ status: "valid" });

    expect(await source.acceptOwnerInvitation(accept(ALEX, "000000"))).toEqual({ status: "code_invalid" });

    expect(await source.previewOwnerInvitation(ALEX)).toEqual({ status: "invalid" });
    expect(await source.acceptOwnerInvitation(accept(ALEX, DEMO_OWNER_CODES.alex))).toEqual({ status: "invalid" });
  });

  it("rattache le compte avec le bon code, ajoute le profil propriétaire et consomme l’invitation", async () => {
    const { source } = createTestEnvironment("sans-profil");
    expect(await source.listProfiles()).toEqual([]);

    expect(await source.acceptOwnerInvitation(accept(ALEX, DEMO_OWNER_CODES.alex))).toEqual({ status: "accepted", role: "holder" });

    const profiles = ((await source.listProfiles()) as unknown[]).map((profile) => profileSchema.parse(profile));
    expect(profiles.map((profile) => [profile.kind, profile.subtitle])).toEqual([["proprietaire", "Cabinet Delmas Immobilier"]]);
    expect(await source.previewOwnerInvitation(ALEX)).toEqual({ status: "invalid" });
  });

  it("exige une adresse vérifiée avant de regarder le jeton", async () => {
    const { source } = createTestEnvironment();
    await source.register({ profile: "voyageur", firstName: "Nina", lastName: "Roy", email: "nina@example.com", password: "Mot-De-Passe-2026" });
    expect(await source.previewOwnerInvitation("Inconnu".padEnd(48, "0"))).toEqual({ status: "email_unverified" });
  });
});
