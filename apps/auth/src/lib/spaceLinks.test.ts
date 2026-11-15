import { afterEach, describe, expect, it, vi } from "vitest";
import { ALLOWED_RETURN_HOSTS, parseReturnTo } from "./returnTo";
import { destinationOfProfile } from "./spaceLinks";

const ABSENT = parseReturnTo(null);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("liste blanche de retour en développement", () => {
  it("autorise les cinq origines locales", () => {
    expect([...ALLOWED_RETURN_HOSTS].sort()).toEqual(["localhost:3010", "localhost:3020", "localhost:3030", "localhost:3040", "localhost:3050"]);
    for (const port of [3010, 3020, 3030, 3040, 3050]) {
      expect(parseReturnTo(`http://localhost:${String(port)}/`).status).toBe("ok");
    }
    expect(parseReturnTo("http://localhost:3060/").status).toBe("refused");
  });
});

describe("destinationOfProfile", () => {
  it("mène à l’accueil de chaque espace via les adresses configurées", () => {
    expect(destinationOfProfile("agence", ABSENT)).toBe("http://localhost:3010/");
    expect(destinationOfProfile("bailleur", ABSENT)).toBe("http://localhost:3020/");
    expect(destinationOfProfile("proprietaire", ABSENT)).toBe("http://localhost:3020/confie");
    expect(destinationOfProfile("locataire", ABSENT)).toBe("http://localhost:3030/");
  });

  it("respecte les variables d’environnement", () => {
    vi.stubEnv("NEXT_PUBLIC_AGENCE_URL", "https://agence.eguardimmo.example");
    expect(destinationOfProfile("agence", ABSENT)).toBe("https://agence.eguardimmo.example/");
  });

  it("reprend l’adresse de retour validée quand elle vise l’espace du profil choisi", () => {
    const returnTo = parseReturnTo("http://localhost:3030/loyers?tri=date");
    expect(destinationOfProfile("locataire", returnTo)).toBe("http://localhost:3030/loyers?tri=date");
    expect(destinationOfProfile("agence", returnTo)).toBe("http://localhost:3010/");
  });

  it("ignore une adresse de retour refusée", () => {
    const returnTo = parseReturnTo("https://pirate.example/");
    expect(returnTo.status).toBe("refused");
    expect(destinationOfProfile("locataire", returnTo)).toBe("http://localhost:3030/");
  });

  it("renvoie null pour un espace sans adresse configurée (voyageur)", () => {
    expect(destinationOfProfile("voyageur", ABSENT)).toBeNull();
  });

  it("renvoie null, sans deviner d’adresse, quand la variable manque en production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_LOCATAIRE_URL", "");
    expect(destinationOfProfile("locataire", ABSENT)).toBeNull();
  });
});
