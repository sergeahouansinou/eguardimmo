import { describe, expect, it } from "vitest";
import { legalBaseUrl, legalLinks } from "./legal";

describe("liens légaux", () => {
  it("en production sans variable : aucune URL de repli, les liens sont masqués", () => {
    expect(legalBaseUrl(undefined, "production")).toBeNull();
    expect(legalBaseUrl("  ", "production")).toBeNull();
    expect(legalLinks(null)).toEqual({ all: [], terms: null });
  });

  it("en production avec une URL https : liens construits sur cette base", () => {
    const base = legalBaseUrl("https://legal.exemple.test/", "production");
    expect(base).toBe("https://legal.exemple.test");
    const { all, terms } = legalLinks(base);
    expect(all.map((link) => link.href)).toEqual([
      "https://legal.exemple.test/confidentialite",
      "https://legal.exemple.test/conditions",
      "https://legal.exemple.test/a-propos",
    ]);
    expect(terms?.href).toBe("https://legal.exemple.test/conditions");
  });

  it("en production refuse une URL non https ou invalide", () => {
    expect(legalBaseUrl("http://legal.exemple.test", "production")).toBeNull();
    expect(legalBaseUrl("javascript:alert(1)", "production")).toBeNull();
    expect(legalBaseUrl("pas-une-url", "production")).toBeNull();
  });

  it("hors production : repli sur l’adresse d’exemple, http accepté", () => {
    expect(legalBaseUrl(undefined, "development")).toBe("https://eguardimmo.example");
    expect(legalBaseUrl(undefined, "test")).toBe("https://eguardimmo.example");
    expect(legalBaseUrl("http://localhost:3999", "development")).toBe("http://localhost:3999");
  });
});
