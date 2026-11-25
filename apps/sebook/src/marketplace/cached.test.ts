import { afterEach, describe, expect, it, vi } from "vitest";
import { clearPublicReads, readListingDetail, readListingsPage, UpstreamUnavailableError } from "./cached";
import { DETAIL, LISTINGS_PAGE, REF } from "./responses.fixtures";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const stub = (response: () => Response | Promise<Response>) => vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(response())));

const KEY = "cle-de-relais-sebook-de-test-0123456789";
const sentHeaders = () => vi.mocked(fetch).mock.calls.map((call) => (call[1]?.headers ?? {}) as Record<string, string>);

afterEach(() => {
  clearPublicReads();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("lectures publiques mises en cache : seul un résultat sûr est renvoyé (donc mémorisé)", () => {
  it.each([429, 500, 502, 503])("la liste lève sur un %i au lieu de renvoyer une valeur", async (status) => {
    stub(() => json({ code: "x" }, status));
    await expect(readListingsPage("kind=short_stay", null)).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it.each([429, 500, 503])("l’annonce lève sur un %i au lieu de renvoyer une valeur", async (status) => {
    stub(() => json({ code: "x" }, status));
    await expect(readListingDetail(REF, null)).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it("la liste lève sur une 404 et sur une réponse hors contrat", async () => {
    stub(() => json({}, 404));
    await expect(readListingsPage("kind=short_stay", null)).rejects.toBeInstanceOf(UpstreamUnavailableError);
    stub(() => json({ data: [{ ref: "x" }], meta: {} }));
    await expect(readListingsPage("kind=short_stay", null)).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it("l’annonce lève sur une réponse hors contrat ou une panne réseau", async () => {
    stub(() => json({ data: { ref: "x" } }));
    await expect(readListingDetail(REF, null)).rejects.toBeInstanceOf(UpstreamUnavailableError);
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("réseau"))));
    await expect(readListingDetail(REF, null)).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it("une vraie 404 d’annonce est une valeur stable (absente), les 200 sont renvoyés", async () => {
    stub(() => json({ code: "not_found" }, 404));
    expect(await readListingDetail(REF, null)).toEqual({ status: "absent" });
    clearPublicReads();
    stub(() => json({ data: DETAIL }));
    expect((await readListingDetail(REF, null)).status).toBe("found");
    stub(() => json(LISTINGS_PAGE));
    const page = await readListingsPage("kind=short_stay", null);
    expect(page.status === "found" && page.value.nextCursor).toBe("eyJpZCI6MTJ9");
  });

  it("n’envoie aucun cookie ni en-tête d’identification à l’API publique", async () => {
    stub(() => json(LISTINGS_PAGE));
    await readListingsPage("kind=short_stay", "203.0.113.7");
    expect(sentHeaders()).toEqual([{ Accept: "application/json" }]);
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.credentials).toBeUndefined();
  });
});

describe("cache partagé entre visiteurs", () => {
  it("la clé ignore le visiteur : son adresse n’est transmise que si l’entrée manque", async () => {
    vi.stubEnv("SEBOOK_RELAY_KEY", KEY);
    stub(() => json(LISTINGS_PAGE));
    await readListingsPage("kind=short_stay", "203.0.113.7");
    await readListingsPage("kind=short_stay", "198.51.100.4");
    expect(sentHeaders()).toHaveLength(1);
    expect(sentHeaders()[0]?.["X-Sebook-Client-Ip"]).toBe("203.0.113.7");
    await readListingsPage("kind=long_term", "198.51.100.4");
    expect(sentHeaders()[1]?.["X-Sebook-Client-Ip"]).toBe("198.51.100.4");
  });

  it("le refus opposé à un visiteur n’est pas servi au suivant", async () => {
    stub(() => json({ code: "too_many_requests" }, 429));
    await expect(readListingDetail(REF, "203.0.113.7")).rejects.toBeInstanceOf(UpstreamUnavailableError);
    stub(() => json({ data: DETAIL }));
    expect((await readListingDetail(REF, "198.51.100.4")).status).toBe("found");
  });

  it("garde annonce trouvée et annonce absente cinq minutes", async () => {
    vi.useFakeTimers({ toFake: ["performance"] });
    stub(() => json({ code: "not_found" }, 404));
    await readListingDetail(REF, null);
    stub(() => json({ data: DETAIL }));
    vi.advanceTimersByTime(299_000);
    expect(await readListingDetail(REF, null)).toEqual({ status: "absent" });
    vi.advanceTimersByTime(1_000);
    expect((await readListingDetail(REF, null)).status).toBe("found");
  });

  it("des recherches à l’infini n’évincent pas les annonces", async () => {
    stub(() => json({ data: DETAIL }));
    await readListingDetail(REF, null);
    stub(() => json(LISTINGS_PAGE));
    for (let price = 0; price < 300; price += 1) await readListingsPage(`min_price=${String(price)}`, null);
    stub(() => json({}, 500));
    expect((await readListingDetail(REF, null)).status).toBe("found");
  });
});
