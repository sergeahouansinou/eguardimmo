import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "./rateLimit";

describe("limitation de débit en mémoire", () => {
  it("autorise jusqu’à la limite puis refuse avec un délai", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, maxKeys: 10 });
    expect(limiter.check("a", 0)).toEqual({ allowed: true });
    expect(limiter.check("a", 1000)).toEqual({ allowed: true });
    expect(limiter.check("a", 2000)).toEqual({ allowed: false, retryAfterSeconds: 58 });
  });

  it("isole les clients et rouvre à la fin de la fenêtre", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 10 });
    limiter.check("a", 0);
    expect(limiter.check("a", 500).allowed).toBe(false);
    expect(limiter.check("b", 500).allowed).toBe(true);
    expect(limiter.check("a", 1000).allowed).toBe(true);
  });

  it("borne la mémoire : au-delà de maxKeys, la plus ancienne entrée est évincée", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 2 });
    limiter.check("a", 0);
    limiter.check("b", 1);
    limiter.check("c", 2);
    expect(limiter.check("a", 3).allowed).toBe(true);
  });

  it("clé client : dernier élément de X-Forwarded-For, sinon X-Real-IP, sinon inconnu", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("2.2.2.2");
    expect(clientKey(new Headers({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(clientKey(new Headers())).toBe("inconnu");
    expect(clientKey(new Headers({ "x-forwarded-for": "x".repeat(200) }))).toHaveLength(64);
  });
});
