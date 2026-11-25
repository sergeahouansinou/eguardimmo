import { afterEach, describe, expect, it, vi } from "vitest";
import { LISTINGS_EMPTY, LISTINGS_LAST_PAGE, SUMMARY_LONG } from "@/marketplace/responses.fixtures";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function stub(handler: (kind: string | null) => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => Promise.resolve(handler(new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url).searchParams.get("kind")))),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function load() {
  const { getHomeListings } = await import("./getHomeListings");
  return getHomeListings();
}

describe("annonces de l’accueil", () => {
  it("charge séjours et longue durée récents", async () => {
    stub((kind) => json(kind === "long_term" ? { data: [SUMMARY_LONG], meta: { has_more: false, next_cursor: null } } : LISTINGS_LAST_PAGE));
    const home = await load();
    expect(home.status).toBe("ready");
    if (home.status !== "ready") return;
    expect(home.short).toHaveLength(1);
    expect(home.long.map((item) => item.public_ref)).toEqual([SUMMARY_LONG.ref]);
  });

  it("une moitié indisponible n’efface pas l’autre", async () => {
    stub((kind) => (kind === "long_term" ? json({}, 500) : json(LISTINGS_LAST_PAGE)));
    const home = await load();
    expect(home.status === "ready" && home.short.length === 1 && home.long.length === 0).toBe(true);
  });

  it("catalogue vide : prêt et vide, pas indisponible", async () => {
    stub(() => json(LISTINGS_EMPTY));
    expect(await load()).toEqual({ status: "ready", short: [], long: [] });
  });

  it("deux pannes : indisponible", async () => {
    stub(() => json({}, 503));
    expect(await load()).toEqual({ status: "unavailable" });
  });
});
