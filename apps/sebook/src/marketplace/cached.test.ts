import { afterEach, describe, expect, it, vi } from "vitest";
import { readListingDetail, readListingsPage, UpstreamUnavailableError } from "./cached";
import { DETAIL, LISTINGS_PAGE, REF } from "./responses.fixtures";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const stub = (response: () => Response | Promise<Response>) => vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(response())));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lectures publiques mises en cache : seul un résultat sûr est renvoyé (donc mémorisé)", () => {
  it.each([429, 500, 502, 503])("la liste lève sur un %i au lieu de renvoyer une valeur", async (status) => {
    stub(() => json({ code: "x" }, status));
    await expect(readListingsPage("kind=short_stay")).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it.each([429, 500, 503])("l’annonce lève sur un %i au lieu de renvoyer une valeur", async (status) => {
    stub(() => json({ code: "x" }, status));
    await expect(readListingDetail(REF)).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it("la liste lève sur une 404 et sur une réponse hors contrat", async () => {
    stub(() => json({}, 404));
    await expect(readListingsPage("kind=short_stay")).rejects.toBeInstanceOf(UpstreamUnavailableError);
    stub(() => json({ data: [{ ref: "x" }], meta: {} }));
    await expect(readListingsPage("kind=short_stay")).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it("l’annonce lève sur une réponse hors contrat ou une panne réseau", async () => {
    stub(() => json({ data: { ref: "x" } }));
    await expect(readListingDetail(REF)).rejects.toBeInstanceOf(UpstreamUnavailableError);
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("réseau"))));
    await expect(readListingDetail(REF)).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it("une vraie 404 d’annonce est une valeur stable (absente), les 200 sont renvoyés", async () => {
    stub(() => json({ code: "not_found" }, 404));
    expect(await readListingDetail(REF)).toEqual({ status: "absent" });
    stub(() => json({ data: DETAIL }));
    expect((await readListingDetail(REF)).status).toBe("found");
    stub(() => json(LISTINGS_PAGE));
    const page = await readListingsPage("kind=short_stay");
    expect(page.status === "found" && page.value.nextCursor).toBe("eyJpZCI6MTJ9");
  });

  it("n’envoie aucun cookie ni en-tête d’identification à l’API publique", async () => {
    stub(() => json(LISTINGS_PAGE));
    await readListingsPage("kind=short_stay");
    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(Object.keys((init?.headers ?? {}) as Record<string, string>)).toEqual(["Accept"]);
    expect(init?.credentials).toBeUndefined();
  });
});
