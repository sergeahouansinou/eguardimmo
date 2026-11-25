import { describe, expect, it } from "vitest";
import { parseOrigin, parseSiteEnv } from "./env";

const PROD = {
  NEXT_PUBLIC_SITE_URL: "https://www.exemple.fr",
  NEXT_PUBLIC_AUTH_URL: "https://auth.exemple.fr",
  NEXT_PUBLIC_AGENCE_URL: "https://agence.exemple.fr",
  NEXT_PUBLIC_PROPRIETAIRE_URL: "https://proprietaire.exemple.fr",
  NEXT_PUBLIC_LOCATAIRE_URL: "https://locataire.exemple.fr",
  NEXT_PUBLIC_SEBOOK_URL: "https://sebook.exemple.fr",
};

describe("environnement public de la vitrine", () => {
  it("accepte une configuration de production complète et normalise les origines", () => {
    const env = parseSiteEnv({ ...PROD, NEXT_PUBLIC_AGENCE_URL: "https://agence.exemple.fr/" }, "production");
    expect(env.NEXT_PUBLIC_AGENCE_URL).toBe("https://agence.exemple.fr");
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://www.exemple.fr");
  });

  it("refuse en production une adresse d’espace absente", () => {
    const incomplete = Object.fromEntries(Object.entries(PROD).filter(([key]) => key !== "NEXT_PUBLIC_SEBOOK_URL"));
    expect(() => parseSiteEnv(incomplete, "production")).toThrow(/NEXT_PUBLIC_SEBOOK_URL/);
  });

  it("traite une variable vide comme absente", () => {
    expect(() => parseSiteEnv({ ...PROD, NEXT_PUBLIC_AUTH_URL: "  " }, "production")).toThrow(/NEXT_PUBLIC_AUTH_URL/);
  });

  it("hors production, retombe sur les adresses locales des applications", () => {
    const env = parseSiteEnv({}, "development");
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3070");
    expect(env.NEXT_PUBLIC_AGENCE_URL).toBe("http://localhost:3010");
    expect(env.NEXT_PUBLIC_SEBOOK_URL).toBe("http://localhost:3060");
  });

  it("refuse http en production hors hôte local, un chemin, des identifiants ou un autre schéma", () => {
    expect(parseOrigin("http://agence.exemple.fr", true)).toBeNull();
    expect(parseOrigin("https://agence.exemple.fr/espace", true)).toBeNull();
    expect(parseOrigin("https://admin:secret@agence.exemple.fr", true)).toBeNull();
    expect(parseOrigin("https://agence.exemple.fr/?a=1", true)).toBeNull();
    expect(parseOrigin("javascript:alert(1)", false)).toBeNull();
    expect(parseOrigin("pas une adresse", false)).toBeNull();
    expect(parseOrigin("http://localhost:3010", false)).toBe("http://localhost:3010");
  });

  it("valide l’adresse e-mail de contact optionnelle", () => {
    expect(parseSiteEnv({ ...PROD, NEXT_PUBLIC_CONTACT_EMAIL: "contact@exemple.fr" }, "production").NEXT_PUBLIC_CONTACT_EMAIL).toBe("contact@exemple.fr");
    expect(() => parseSiteEnv({ ...PROD, NEXT_PUBLIC_CONTACT_EMAIL: "pas-un-mail" }, "production")).toThrow();
  });
});
