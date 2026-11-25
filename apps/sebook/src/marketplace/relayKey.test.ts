import { describe, expect, it } from "vitest";
import { relayKey } from "./relayKey";

const KEY = "cle-de-relais-sebook-de-test-0123456789";

describe("clé de relais de SeBook", () => {
  it("rend la clé d’au moins 32 caractères, en production comme en développement", () => {
    expect(relayKey({ NODE_ENV: "production", SEBOOK_RELAY_KEY: KEY })).toBe(KEY);
    expect(relayKey({ NODE_ENV: "development", SEBOOK_RELAY_KEY: "k".repeat(32) })).toBe("k".repeat(32));
  });

  it("hors production, une clé absente désactive le relais", () => {
    expect(relayKey({ NODE_ENV: "development" })).toBeNull();
    expect(relayKey({ NODE_ENV: "test", SEBOOK_RELAY_KEY: "" })).toBeNull();
  });

  it.each([undefined, "", "k".repeat(31)])("en production, refuse la clé %o", (key) => {
    expect(() => relayKey({ NODE_ENV: "production", SEBOOK_RELAY_KEY: key })).toThrow(/SEBOOK_RELAY_KEY/);
  });

  it("une clé trop courte est refusée même hors production, sans apparaître dans le message", () => {
    expect(() => relayKey({ NODE_ENV: "development", SEBOOK_RELAY_KEY: "secret-court" })).toThrow(/SEBOOK_RELAY_KEY/);
    expect(() => relayKey({ NODE_ENV: "development", SEBOOK_RELAY_KEY: "secret-court" })).not.toThrow(/secret-court/);
  });
});
