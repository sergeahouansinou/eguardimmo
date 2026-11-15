import { describe, expect, it } from "vitest";
import {
  backupCodeFormSchema,
  deleteAccountSchema,
  emailSchema,
  invitationSchema,
  newPasswordSchema,
  registerAgenceSchema,
  resetPasswordSchema,
  signInSchema,
  totpCodeSchema,
} from "./schemas";

describe("schémas de formulaire", () => {
  it("rogne et valide l’e-mail", () => {
    expect(emailSchema.parse("  marc@example.com ")).toBe("marc@example.com");
    expect(emailSchema.safeParse("pas-un-email").success).toBe(false);
    expect(emailSchema.safeParse("").success).toBe(false);
  });

  it("exige 12 caractères, une majuscule et un chiffre", () => {
    expect(newPasswordSchema.safeParse("Mot-De-Passe-2026").success).toBe(true);
    expect(newPasswordSchema.safeParse("Court1").success).toBe(false);
    expect(newPasswordSchema.safeParse("motdepassesansmajuscule1").success).toBe(false);
    expect(newPasswordSchema.safeParse("MotDePasseSansChiffre").success).toBe(false);
  });

  it("exige un mot de passe à la connexion", () => {
    expect(signInSchema.safeParse({ email: "a@example.com", password: "" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@example.com", password: "x" }).success).toBe(true);
  });

  it("refuse une confirmation différente", () => {
    const result = resetPasswordSchema.safeParse({ password: "Mot-De-Passe-2026", confirmation: "Autre-2026-Mot" });
    expect(result.success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "Mot-De-Passe-2026", confirmation: "Mot-De-Passe-2026" }).success).toBe(true);
  });

  it("accepte un code TOTP avec espaces et refuse le reste", () => {
    expect(totpCodeSchema.parse("481 305")).toBe("481305");
    for (const invalid of ["48130", "4813055", "abcdef", ""]) expect(totpCodeSchema.safeParse(invalid).success).toBe(false);
  });

  it("valide le format d’un code de secours", () => {
    expect(backupCodeFormSchema.safeParse({ code: "r5n7v-4bj2e" }).success).toBe(true);
    expect(backupCodeFormSchema.safeParse({ code: "r5n7v4bj2e" }).success).toBe(true);
    expect(backupCodeFormSchema.safeParse({ code: "court" }).success).toBe(false);
  });

  it("exige le mot SUPPRIMER exact", () => {
    expect(deleteAccountSchema.safeParse({ confirmation: "SUPPRIMER" }).success).toBe(true);
    expect(deleteAccountSchema.safeParse({ confirmation: "supprimer" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ confirmation: "" }).success).toBe(false);
  });

  it("exige l’acceptation des conditions", () => {
    expect(invitationSchema.safeParse({ password: "Mot-De-Passe-2026", acceptTerms: false }).success).toBe(false);
    expect(invitationSchema.safeParse({ password: "Mot-De-Passe-2026", acceptTerms: true }).success).toBe(true);
  });

  it("valide le SIREN de l’agence (9 chiffres, espaces tolérés)", () => {
    const base = { agencyName: "Cabinet", email: "a@example.com", password: "Mot-De-Passe-2026", acceptTerms: true };
    expect(registerAgenceSchema.safeParse({ ...base, siren: "123 456 789" }).success).toBe(true);
    expect(registerAgenceSchema.safeParse({ ...base, siren: "12345" }).success).toBe(false);
  });
});
