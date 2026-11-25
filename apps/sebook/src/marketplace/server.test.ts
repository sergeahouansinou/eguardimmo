import { afterEach, describe, expect, it, vi } from "vitest";
import { DETAIL, LISTINGS_LAST_PAGE, LISTINGS_PAGE, REF, REF_2 } from "./responses.fixtures";
import { EMPTY_SEARCH } from "./search";
import { fetchAllListings, fetchListing, fetchListings } from "./server";

function urlOf(input: RequestInfo | URL): URL {
  if (typeof input === "string") return new URL(input);
  return new URL(input instanceof URL ? input.href : input.url);
}

function stubFetch(handler: (url: URL) => Response | Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => Promise.resolve(handler(urlOf(input))));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchListings", () => {
  it("interroge /api/v1/marketplace/listings et renvoie annonces et curseur", async () => {
    const fetchMock = stubFetch(() => json(LISTINGS_PAGE));
    const result = await fetchListings({ ...EMPTY_SEARCH, place: "lyon", amenities: ["wifi"], minPrice: 40 });
    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.value.items.map((item) => item.public_ref)).toEqual([REF, REF_2]);
    expect(result.value.nextCursor).toBe("eyJpZCI6MTJ9");
    const url = urlOf(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(url.origin + url.pathname).toBe("http://api.test/api/v1/marketplace/listings");
    expect(url.searchParams.get("kind")).toBe("short_stay");
    expect(url.searchParams.get("place")).toBe("lyon");
    expect(url.searchParams.getAll("amenities[]")).toEqual(["wifi"]);
    expect(url.searchParams.get("min_price")).toBe("4000");
  });

  it("panne de l’API : non vérifiable, jamais une liste vide", async () => {
    stubFetch(() => json({ code: "server_error" }, 503));
    expect((await fetchListings(EMPTY_SEARCH)).status).toBe("unavailable");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("réseau"))));
    expect((await fetchListings(EMPTY_SEARCH)).status).toBe("unavailable");
  });

  it("429 (quota) : non vérifiable, jamais une liste vide ni une annonce absente", async () => {
    stubFetch(() => json({ code: "too_many_requests" }, 429));
    expect((await fetchListings(EMPTY_SEARCH)).status).toBe("unavailable");
    expect((await fetchListing(REF)).status).toBe("unavailable");
  });

  it("réponse hors contrat : non vérifiable", async () => {
    stubFetch(() => json({ data: [{ public_ref: "x" }], meta: { next_cursor: null } }));
    expect((await fetchListings(EMPTY_SEARCH)).status).toBe("unavailable");
  });
});

describe("fetchListing", () => {
  it("trouve une annonce publiée", async () => {
    stubFetch(() => json({ data: DETAIL }));
    const result = await fetchListing(REF);
    expect(result.status).toBe("found");
    if (result.status === "found") expect(result.value.description).toContain("28 m²");
  });

  it("404 : absente ; 500 : non vérifiable", async () => {
    stubFetch(() => json({ code: "not_found", status: 404 }, 404));
    expect((await fetchListing(REF)).status).toBe("absent");
    stubFetch(() => json({ code: "server_error", status: 500 }, 500));
    expect((await fetchListing(REF)).status).toBe("unavailable");
  });

  it("une référence mal formée n’atteint jamais l’API", async () => {
    const fetchMock = stubFetch(() => json({ data: DETAIL }));
    expect((await fetchListing("../../auth/token")).status).toBe("absent");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchAllListings", () => {
  it("parcourt les deux portées jusqu’au dernier curseur, sans doublon", async () => {
    const fetchMock = stubFetch((url) => json(url.searchParams.get("after") ? LISTINGS_LAST_PAGE : LISTINGS_PAGE));
    const result = await fetchAllListings();
    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.value.map((item) => item.public_ref).sort()).toEqual([REF, REF_2].sort());
    const kinds = fetchMock.mock.calls.map((call) => urlOf(call[0]).searchParams.get("kind"));
    expect(kinds).toEqual(["short_stay", "short_stay", "long_term", "long_term"]);
  });

  it("échoue en entier si une page est indisponible", async () => {
    let calls = 0;
    stubFetch(() => (++calls === 2 ? json({}, 500) : json(LISTINGS_PAGE)));
    expect((await fetchAllListings()).status).toBe("unavailable");
  });
});
