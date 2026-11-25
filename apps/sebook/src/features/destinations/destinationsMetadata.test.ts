import { describe, expect, it } from "vitest";
import { SUMMARY, SUMMARY_LONG } from "@/marketplace/responses.fixtures";
import { listingSummarySchema } from "@/marketplace/schemas";
import { EMPTY_SEARCH, searchFromParams } from "@/marketplace/search";
import { destinationsMetadata, destinationsTitle, isIndexableSearch, placeNameFrom } from "./destinationsMetadata";

const items = [SUMMARY, SUMMARY_LONG].map((item) => listingSummarySchema.parse(item));

describe("métadonnées destinations", () => {
  it("indexe la liste générale d’une portée, canonique sur la portée seule", () => {
    const meta = destinationsMetadata(EMPTY_SEARCH, null);
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.alternates?.canonical).toBe("/destinations");
    expect(meta.title).toEqual({ absolute: "Logements à réserver - SeBook" });
    expect(destinationsMetadata({ ...EMPTY_SEARCH, scope: "long_term" }, null).alternates?.canonical).toBe("/destinations?portee=longue-duree");
  });

  it.each([
    ["un lieu", { place: "lyon" }],
    ["un lieu et un texte libre", { place: "lyon", lieu: "Texte libre" }],
    ["des dates", { arrivee: "2027-03-20", depart: "2027-03-22" }],
    ["un filtre", { voyageurs: "2" }],
    ["un tri", { tri: "price_asc" }],
    ["un curseur", { apres: "abc" }],
    ["une catégorie", { categorie: "house" }],
    ["un équipement", { equipements: "wifi" }],
  ])("n’indexe pas une page avec %s", (_label, raw) => {
    expect(destinationsMetadata(searchFromParams(raw), null).robots).toEqual({ index: false, follow: true });
  });

  it("le canonique ne contient jamais le lieu ni un texte libre de l’URL", () => {
    const meta = destinationsMetadata(searchFromParams({ place: "lyon", lieu: "Texte libre", portee: "longue-duree" }), "Lyon");
    expect(meta.alternates?.canonical).toBe("/destinations?portee=longue-duree");
  });

  it("n’utilise que le nom du lieu renvoyé par l’API, jamais lieu", () => {
    const search = searchFromParams({ place: "lyon", lieu: "<script>x</script>" });
    const meta = destinationsMetadata(search, placeNameFrom(search, items));
    expect(meta.title).toEqual({ absolute: "Logements à réserver à Lyon - SeBook" });
    expect(JSON.stringify(meta)).not.toContain("<script");
    expect(JSON.stringify(meta)).not.toContain("Texte");
  });

  it("nom du lieu : seulement si l’API a renvoyé une annonce de ce lieu", () => {
    expect(placeNameFrom(searchFromParams({ place: "lyon" }), items)).toBe("Lyon");
    expect(placeNameFrom(searchFromParams({ place: "nantes" }), items)).toBeNull();
    expect(placeNameFrom(searchFromParams({ place: "lyon" }), [])).toBeNull();
    expect(placeNameFrom(EMPTY_SEARCH, items)).toBeNull();
  });

  it("titre distinct pour la longue durée ; indexabilité de la portée seule", () => {
    expect(destinationsTitle({ ...EMPTY_SEARCH, scope: "long_term" }, null)).toBe("Logements en longue durée");
    expect(isIndexableSearch({ ...EMPTY_SEARCH, scope: "long_term" })).toBe(true);
  });
});
