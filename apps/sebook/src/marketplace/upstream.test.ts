import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublic } from "./upstream";

const KEY = "cle-de-relais-sebook-de-test-0123456789";

function stubFetch() {
  const fetchMock = vi.fn(() => Promise.resolve(new Response("{}", { status: 200 })));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const initOf = (fetchMock: ReturnType<typeof stubFetch>) => (fetchMock.mock.calls[0] as unknown as [URL, RequestInit])[1];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("en-têtes envoyés à l’API publique", () => {
  it("sans clé de relais : ni clé, ni adresse, ni cookie", async () => {
    const fetchMock = stubFetch();
    await getPublic("/listings", undefined, "203.0.113.7");
    expect(initOf(fetchMock).headers).toEqual({ Accept: "application/json" });
    expect(initOf(fetchMock).credentials).toBeUndefined();
  });

  it("avec la clé : la clé et l’adresse du visiteur", async () => {
    vi.stubEnv("SEBOOK_RELAY_KEY", KEY);
    const fetchMock = stubFetch();
    await getPublic("/listings", undefined, "203.0.113.7");
    expect(initOf(fetchMock).headers).toEqual({ Accept: "application/json", "X-Sebook-Relay-Key": KEY, "X-Sebook-Client-Ip": "203.0.113.7" });
  });

  it("avec la clé et sans visiteur : la clé seule", async () => {
    vi.stubEnv("SEBOOK_RELAY_KEY", KEY);
    const fetchMock = stubFetch();
    await getPublic("/listings", undefined, null);
    expect(initOf(fetchMock).headers).toEqual({ Accept: "application/json", "X-Sebook-Relay-Key": KEY });
  });

  it("ne suit aucune redirection, pour que la clé ne parte pas vers un autre hôte", async () => {
    const fetchMock = stubFetch();
    await getPublic("/listings", undefined, null);
    expect(initOf(fetchMock).redirect).toBe("error");
    expect(initOf(fetchMock).cache).toBe("no-store");
  });
});
