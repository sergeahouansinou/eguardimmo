import { afterEach, describe, expect, it, vi } from "vitest";

async function loadEnv() {
  vi.resetModules();
  return import("./env");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("variables publiques de l'agence", () => {
  it("prend la démonstration par défaut hors production, sans exiger l'URL de l'API", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", undefined);
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    const env = await loadEnv();

    expect(env.dataSource).toBe("demo");
  });

  it("lit la source api et ne valide l'URL de l'API qu'à la demande", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "api");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const env = await loadEnv();

    expect(env.dataSource).toBe("api");
    expect(() => env.apiEnv()).toThrow();
  });

  it("expose l'URL de l'API et celle de la connexion une fois renseignées", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "api");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.eguardimmo.test");
    vi.stubEnv("NEXT_PUBLIC_AUTH_URL", "https://auth.eguardimmo.test");
    const env = await loadEnv();

    expect(env.apiEnv()).toEqual({
      NEXT_PUBLIC_API_URL: "https://api.eguardimmo.test",
      NEXT_PUBLIC_AUTH_URL: "https://auth.eguardimmo.test",
      NEXT_PUBLIC_DATA_SOURCE: "api",
    });
  });

  it("refuse une source de données inconnue avec un message clair", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "mock");

    await expect(loadEnv()).rejects.toThrow(/demo ou api/);
  });
});
