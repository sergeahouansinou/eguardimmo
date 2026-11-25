import { describe, expect, it } from "vitest";
import { DETAIL, DETAIL_LONG, REF, REF_2 } from "./responses.fixtures";
import { galleryScenes, paragraphsOf, toAnnonceView } from "./roostDetail";
import { listingDetailSchema } from "./schemas";

const stay = listingDetailSchema.parse(DETAIL);
const long = listingDetailSchema.parse(DETAIL_LONG);

describe("toAnnonceView", () => {
  it("convertit une annonce de séjour en vue Roost", () => {
    const view = toAnnonceView(stay, "fr-FR");
    expect(view).toMatchObject({
      ref: REF,
      title: "Studio lumineux, Presqu’île",
      kind: "short_stay",
      categoryKey: "ficheCatStudio",
      place: "Presqu’île, Lyon",
      cityName: "Lyon",
      hostName: "Agence Rhône Immo",
      hostInitial: "A",
      priceLabel: "74 €",
      priceUnitKey: "unitDay",
      capacity: 2,
      minNights: 2,
      policy: "moderate",
    });
    expect(view.facts).toEqual([
      { key: "factGuests", value: 2 },
      { key: "factRoomOne", value: 1 },
      { key: "factArea", value: "28" },
    ]);
  });

  it("formate la surface selon la langue et le pluriel des pièces", () => {
    expect(toAnnonceView(long, "fr-FR").facts).toContainEqual({ key: "factArea", value: "46,5" });
    expect(toAnnonceView(long, "en-US").facts).toContainEqual({ key: "factArea", value: "46.5" });
    expect(toAnnonceView(long, "fr-FR").facts).toContainEqual({ key: "factRooms", value: 2 });
  });

  it("n’invente aucun fait absent de l’API", () => {
    const bare = listingDetailSchema.parse({ ...DETAIL, rooms: null, area_m2: null, capacity: 1, host: { name: null } });
    const view = toAnnonceView(bare, "fr-FR");
    expect(view.facts).toEqual([{ key: "factGuestOne", value: 1 }]);
    expect(view.hostName).toBeNull();
    expect(view.hostInitial).toBe("");
  });

  it("traduit les équipements connus et garde un repli lisible pour un identifiant inconnu", () => {
    const view = toAnnonceView(listingDetailSchema.parse({ ...DETAIL, amenities: ["wifi", "step_free_access", "sauna", "wifi"] }), "fr-FR");
    expect(view.amenities.map((amenity) => amenity.id)).toEqual(["wifi", "step_free_access", "sauna"]);
    expect(view.amenities[0]?.labelKey).toBe("ficheAmWifi");
    expect(view.amenities[2]).toMatchObject({ labelKey: null, fallbackLabel: "sauna" });
    expect(view.amenities.every((amenity) => amenity.icon.length > 0)).toBe(true);
  });

  it("couvre les seize équipements de l’API", () => {
    const ids = ["wifi", "kitchen", "washer", "dishwasher", "air_conditioning", "heating", "parking", "elevator", "balcony", "terrace", "garden", "pool", "tv", "workspace", "pets_allowed", "step_free_access"];
    const view = toAnnonceView(listingDetailSchema.parse({ ...DETAIL, amenities: ids }), "fr-FR");
    expect(view.amenities.every((amenity) => amenity.labelKey !== null)).toBe(true);
  });

  it("liste référence, séjour minimum et caution réels, sans séjour minimum en longue durée", () => {
    const keys = toAnnonceView(stay, "fr-FR").characteristics.map((item) => [item.labelKey, item.value]);
    expect(keys).toEqual([
      ["charRef", REF],
      ["ficheCharMinStay", "2"],
      ["charSecurityDeposit", "300 €"],
    ]);
    expect(toAnnonceView(long, "fr-FR").characteristics.map((item) => item.labelKey)).toEqual(["charRef"]);
  });

  it("exprime le prix mensuel de la longue durée", () => {
    const view = toAnnonceView(long, "fr-FR");
    expect(view).toMatchObject({ priceLabel: "850 €", priceUnitKey: "unitMonth", ref: REF_2 });
  });

  it("affiche les montants avec leurs centimes au lieu de les arrondir", () => {
    const view = toAnnonceView(listingDetailSchema.parse({ ...DETAIL, price: { amount: 7450, currency: "EUR" } }), "fr-FR");
    expect(view.priceLabel).toBe("74,50 €");
  });
});

describe("paragraphsOf", () => {
  it("découpe sur les retours à la ligne et ignore les lignes vides", () => {
    expect(paragraphsOf("Un.\n\n  Deux.\r\nTrois.\n")).toEqual(["Un.", "Deux.", "Trois."]);
    expect(paragraphsOf("  ")).toEqual([]);
  });
});

describe("galleryScenes", () => {
  it("est déterministe, de cinq tuiles et commence par la scène de la carte", () => {
    const scenes = galleryScenes(REF);
    expect(scenes).toHaveLength(5);
    expect(galleryScenes(REF)).toEqual(scenes);
    expect(new Set(scenes).size).toBe(5);
    expect(toAnnonceView(stay, "fr-FR").scene).toBe(scenes[0]);
  });
});
