import { describe, expect, it, vi } from "vitest";
import { createBoundedCache } from "./boundedCache";

const clock = () => {
  let time = 0;
  return { now: () => time, advance: (ms: number) => (time += ms) };
};

const loader = (value: string) => vi.fn(() => Promise.resolve(value));

describe("cache mémoire borné", () => {
  it("ne charge qu’une fois la même clé tant que l’entrée vit", async () => {
    const time = clock();
    const cache = createBoundedCache<string>({ ttlMs: 1000, maxEntries: 10, now: time.now });
    const load = loader("a");
    expect(await cache.read("k", load)).toBe("a");
    time.advance(999);
    expect(await cache.read("k", load)).toBe("a");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("recharge à l’expiration, sans qu’une lecture ne prolonge l’entrée", async () => {
    const time = clock();
    const cache = createBoundedCache<string>({ ttlMs: 1000, maxEntries: 10, now: time.now });
    await cache.read("k", loader("ancienne"));
    time.advance(600);
    await cache.read("k", loader("inutile"));
    time.advance(400);
    expect(await cache.read("k", loader("neuve"))).toBe("neuve");
  });

  it("ne mémorise jamais un chargement qui lève, et ne sert pas la valeur périmée", async () => {
    const time = clock();
    const cache = createBoundedCache<string>({ ttlMs: 1000, maxEntries: 10, now: time.now });
    await expect(cache.read("k", () => Promise.reject(new Error("429")))).rejects.toThrow("429");
    expect(await cache.read("k", loader("a"))).toBe("a");
    time.advance(1000);
    await expect(cache.read("k", () => Promise.reject(new Error("panne")))).rejects.toThrow("panne");
  });

  it("évince l’entrée la moins récemment lue au-delà de la taille maximale", async () => {
    const cache = createBoundedCache<string>({ ttlMs: 1000, maxEntries: 2, now: () => 0 });
    await cache.read("a", loader("a"));
    await cache.read("b", loader("b"));
    await cache.read("a", loader("inutile"));
    await cache.read("c", loader("c"));
    const reloadA = loader("a2");
    const reloadB = loader("b2");
    expect(await cache.read("a", reloadA)).toBe("a");
    expect(await cache.read("b", reloadB)).toBe("b2");
    expect(reloadA).not.toHaveBeenCalled();
  });

  it("ne fait pas partager une lecture en cours : l’échec de l’un n’atteint pas l’autre", async () => {
    const cache = createBoundedCache<string>({ ttlMs: 1000, maxEntries: 10, now: () => 0 });
    const first = cache.read("k", () => Promise.reject(new Error("429")));
    const second = cache.read("k", loader("a"));
    await expect(first).rejects.toThrow("429");
    await expect(second).resolves.toBe("a");
  });

  it("se vide sur demande", async () => {
    const cache = createBoundedCache<string>({ ttlMs: 1000, maxEntries: 10, now: () => 0 });
    await cache.read("k", loader("a"));
    cache.clear();
    expect(await cache.read("k", loader("b"))).toBe("b");
  });
});
