import { afterEach, describe, expect, it, vi } from "vitest";

const SPACES = {
  NEXT_PUBLIC_AGENCE_URL: "https://agence.exemple.fr",
  NEXT_PUBLIC_PROPRIETAIRE_URL: "https://proprietaire.exemple.fr",
  NEXT_PUBLIC_LOCATAIRE_URL: "https://locataire.exemple.fr",
  NEXT_PUBLIC_SEBOOK_URL: "https://sebook.exemple.fr",
  NEXT_PUBLIC_AUTH_URL: "https://auth.exemple.fr",
};

async function load() {
  vi.resetModules();
  return import("./links");
}

describe("liens vers les espaces", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("viennent des variables d’environnement publiques", async () => {
    for (const [key, value] of Object.entries(SPACES)) vi.stubEnv(key, value);
    const { spaceLinks, loginUrl } = await load();
    expect(Object.fromEntries(spaceLinks().map((space) => [space.key, space.href]))).toEqual({
      agence: SPACES.NEXT_PUBLIC_AGENCE_URL,
      proprietaire: SPACES.NEXT_PUBLIC_PROPRIETAIRE_URL,
      locataire: SPACES.NEXT_PUBLIC_LOCATAIRE_URL,
      sebook: SPACES.NEXT_PUBLIC_SEBOOK_URL,
    });
    expect(loginUrl()).toBe(SPACES.NEXT_PUBLIC_AUTH_URL);
  });

  it("une variable invalide fait échouer la lecture au lieu de produire un lien douteux", async () => {
    vi.stubEnv("NEXT_PUBLIC_AGENCE_URL", "https://agence.exemple.fr/chemin");
    const { spaceLinks } = await load();
    expect(() => spaceLinks()).toThrow(/NEXT_PUBLIC_AGENCE_URL/);
  });

  it("production : une adresse d’espace manquante est une erreur", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.exemple.fr");
    const { spaceLinks } = await load();
    expect(() => spaceLinks()).toThrow(/NEXT_PUBLIC_/);
  });
});
