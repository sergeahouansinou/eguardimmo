import { describe, expect, it } from "vitest";
import { contactSchema, fieldErrors } from "./schema";

const VALID = { organisation: "Agence Rhône Immo", email: "contact@agence-exemple.fr", profil: "agence", consentement: true };

describe("schéma du formulaire de contact", () => {
  it("accepte une demande complète, message facultatif", () => {
    expect(contactSchema.safeParse(VALID).success).toBe(true);
    expect(contactSchema.safeParse({ ...VALID, message: "Bonjour" }).success).toBe(true);
  });

  it("nettoie les espaces en bordure", () => {
    const parsed = contactSchema.parse({ ...VALID, organisation: "  Agence Rhône Immo  ", email: " contact@agence-exemple.fr " });
    expect(parsed.organisation).toBe("Agence Rhône Immo");
    expect(parsed.email).toBe("contact@agence-exemple.fr");
  });

  it.each([
    ["organisation", { organisation: "A" }],
    ["organisation", { organisation: "x".repeat(121) }],
    ["email", { email: "pas-un-mail" }],
    ["email", { email: `${"a".repeat(250)}@exemple.fr` }],
    ["profil", { profil: "administrateur" }],
    ["message", { message: "x".repeat(1001) }],
    ["consentement", { consentement: false }],
  ])("refuse un champ %s invalide", (field, patch) => {
    const result = contactSchema.safeParse({ ...VALID, ...patch });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error)).toHaveProperty(field);
  });

  it("refuse les caractères de contrôle", () => {
    expect(contactSchema.safeParse({ ...VALID, organisation: "Agence\u0000Immo" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...VALID, message: "ligne 1\nligne 2" }).success).toBe(true);
  });

  it("refuse tout champ inconnu (liste blanche) et un leurre rempli", () => {
    expect(contactSchema.safeParse({ ...VALID, role: "admin" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...VALID, siteWeb: "http://spam.example" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...VALID, siteWeb: "" }).success).toBe(true);
  });

  it("rapporte un message par champ", () => {
    const result = contactSchema.safeParse({ organisation: "", email: "", profil: "", consentement: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(fieldErrors(result.error)).sort()).toEqual(["consentement", "email", "organisation", "profil"]);
    }
  });
});
