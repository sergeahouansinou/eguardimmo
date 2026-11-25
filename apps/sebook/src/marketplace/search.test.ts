import { describe, expect, it } from "vitest";
import { EMPTY_SEARCH, apiListingParams, searchFromParams, searchHref } from "./search";

describe("searchFromParams", () => {
  it("lit des paramètres valides", () => {
    const search = searchFromParams({
      portee: "sejours",
      place: "lyon",
      lieu: "Lyon",
      categorie: "studio",
      voyageurs: "2",
      prix_min: "40",
      prix_max: "200",
      equipements: "wifi,kitchen",
      tri: "price_asc",
      apres: "eyJpZCI6MTJ9",
      arrivee: "2027-03-20",
      depart: "2027-03-22",
    });
    expect(search).toMatchObject({ scope: "short_stay", place: "lyon", category: "studio", guests: 2, minPrice: 40, maxPrice: 200, amenities: ["wifi", "kitchen"], sort: "price_asc", after: "eyJpZCI6MTJ9", checkIn: "2027-03-20", checkOut: "2027-03-22" });
  });

  it("n’accepte pour le lieu qu’un slug : aucun texte libre ni paramètre lieu", () => {
    expect(searchFromParams({ place: "Lyon <b>", lieu: "Texte libre" }).place).toBe("");
    expect(searchFromParams({ place: "a".repeat(81) }).place).toBe("");
    expect(searchFromParams({ place: "lyon-3e", lieu: "Texte libre" })).toEqual({ ...EMPTY_SEARCH, place: "lyon-3e" });
    expect(searchHref({ ...EMPTY_SEARCH, place: "lyon" })).not.toContain("lieu");
  });

  it("ignore les valeurs invalides et retombe sur les défauts", () => {
    const search = searchFromParams({ categorie: "chateau", voyageurs: "-3", prix_min: "abc", equipements: "wifi,<script>,x y", tri: "hack", apres: "a b;c", arrivee: "2027-03-22", depart: "2027-03-20" });
    expect(search).toEqual({ ...EMPTY_SEARCH, amenities: ["wifi"] });
  });

  it("n’applique pas de dates à la longue durée", () => {
    const search = searchFromParams({ portee: "longue-duree", arrivee: "2027-03-20", depart: "2027-03-22" });
    expect(search.scope).toBe("long_term");
    expect(search.checkIn).toBe("");
  });

  it("prend la première valeur d’un paramètre répété", () => {
    expect(searchFromParams({ place: ["lyon", "lille"] }).place).toBe("lyon");
  });
});

describe("searchHref", () => {
  it("n’écrit que les valeurs non défauts et relit à l’identique", () => {
    expect(searchHref(EMPTY_SEARCH)).toBe("/destinations");
    const search = { ...EMPTY_SEARCH, scope: "long_term" as const, place: "lyon", category: "house" as const, amenities: ["wifi"], sort: "recent" as const };
    const href = searchHref(search);
    expect(href).toBe("/destinations?portee=longue-duree&place=lyon&categorie=house&equipements=wifi&tri=recent");
    expect(searchFromParams(Object.fromEntries(new URL(href, "http://x").searchParams))).toEqual(search);
  });
});

describe("apiListingParams", () => {
  it("construit la requête de l’ADR 0041 avec prix en unité mineure et amenities[] répété", () => {
    const params = apiListingParams(
      { ...EMPTY_SEARCH, place: "lyon", category: "studio", guests: 2, minPrice: 40, maxPrice: 200, amenities: ["wifi", "kitchen"], sort: "price_desc", after: "CUR" },
      (major) => major * 100,
    );
    expect(params.toString()).toBe(
      "kind=short_stay&place=lyon&category=studio&guests=2&min_price=4000&max_price=20000&amenities%5B%5D=wifi&amenities%5B%5D=kitchen&sort=price_desc&per_page=12&after=CUR",
    );
  });

  it("limite per_page à 12 (maximum de l’ADR : 24)", () => {
    expect(apiListingParams(EMPTY_SEARCH, (m) => m).get("per_page")).toBe("12");
  });
});
