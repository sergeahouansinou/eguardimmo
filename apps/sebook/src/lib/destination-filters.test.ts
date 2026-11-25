import { describe, expect, it } from "vitest";
import { EMPTY_SEARCH } from "@/marketplace/search";
import { applyDraft, countActiveFilters, draftFromSearch } from "./destination-filters";

describe("filtres destinations", () => {
  it("relit la recherche courante dans le brouillon", () => {
    const search = { ...EMPTY_SEARCH, guests: 4, minPrice: 50, amenities: ["wifi"], sort: "recent" as const };
    expect(draftFromSearch(search)).toEqual({ guests: 4, minPrice: "50", maxPrice: "", amenities: ["wifi"], sort: "recent" });
  });

  it("applique un brouillon valide et revient à la première page", () => {
    const base = { ...EMPTY_SEARCH, after: "abc", place: "lyon" };
    const result = applyDraft(base, { guests: 2, minPrice: "40", maxPrice: "120", amenities: ["kitchen"], sort: "price_asc" });
    expect(result).toEqual({ ok: true, search: { ...base, after: null, guests: 2, minPrice: 40, maxPrice: 120, amenities: ["kitchen"], sort: "price_asc" } });
  });

  it("zéro voyageur et prix vides n’écrivent aucun filtre", () => {
    const result = applyDraft(EMPTY_SEARCH, { guests: 0, minPrice: " ", maxPrice: "", amenities: [], sort: "relevance" });
    expect(result).toEqual({ ok: true, search: EMPTY_SEARCH });
  });

  it.each([
    ["montant non numérique", { minPrice: "abc", maxPrice: "" }, { minPrice: true }],
    ["montant négatif", { minPrice: "", maxPrice: "-5" }, { maxPrice: true }],
    ["montant décimal", { minPrice: "12.5", maxPrice: "" }, { minPrice: true }],
    ["minimum au-dessus du maximum", { minPrice: "90", maxPrice: "50" }, { range: true }],
  ])("refuse : %s", (_label, prices, errors) => {
    expect(applyDraft(EMPTY_SEARCH, { guests: 0, amenities: [], sort: "relevance", ...prices })).toEqual({ ok: false, errors });
  });

  it("compte voyageurs, prix, équipements et tri", () => {
    expect(countActiveFilters(EMPTY_SEARCH)).toBe(0);
    expect(countActiveFilters({ ...EMPTY_SEARCH, guests: 2, minPrice: 1, maxPrice: 9, amenities: ["wifi", "kitchen"], sort: "recent" })).toBe(5);
  });
});
