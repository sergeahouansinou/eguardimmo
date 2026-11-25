import { describe, expect, it } from "vitest";
import { emptyListingForm, formFromListing, listingFormSchema, toPayload } from "./form";
import type { ListingForm } from "./form";
import type { Listing } from "./schemas";

const valid: ListingForm = { ...emptyListingForm(), title: "Studio lumineux", price: "85,50", capacity: "2", deposit: "200" };

const issues = (values: Partial<ListingForm>): string[] => {
  const result = listingFormSchema.safeParse({ ...valid, ...values });
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
};

describe("formulaire d’annonce", () => {
  it("convertit les montants saisis en entiers d’unités mineures", () => {
    expect(toPayload(valid, true)).toMatchObject({ kind: "short_stay", priceMinor: 8550, depositMinor: 20000, capacity: 2, minNights: 1, description: null });
    expect(toPayload({ ...valid, currency: "XOF", price: "45000", deposit: "" }, false)).toMatchObject({ priceMinor: 45000, depositMinor: null, currency: "XOF" });
    expect(toPayload(valid, false)).not.toHaveProperty("kind");
  });

  it("ne garde que des équipements connus, dans l’ordre du catalogue", () => {
    expect(toPayload({ ...valid, amenities: ["pool", "wifi"] }, true).amenities).toEqual(["wifi", "pool"]);
  });

  it("refuse le HTML, les caractères de contrôle et les valeurs hors bornes", () => {
    expect(issues({})).toEqual([]);
    expect(issues({ title: "<b>Promo</b>" })).toEqual(["title"]);
    expect(issues({ title: "" })).toEqual(["title"]);
    expect(issues({ description: "Ligne 1\nLigne 2" })).toEqual([]);
    expect(issues({ description: "Texte <script>" })).toEqual(["description"]);
    expect(issues({ description: "a‮b" })).toEqual(["description"]);
    expect(issues({ price: "0" })).toEqual(["price"]);
    expect(issues({ price: "abc" })).toEqual(["price"]);
    expect(issues({ price: "2000000" })).toEqual(["price"]);
    expect(issues({ capacity: "51" })).toEqual(["capacity"]);
    expect(issues({ rooms: "1,5" })).toEqual(["rooms"]);
    expect(issues({ minNights: "" })).toEqual(["minNights"]);
    expect(issues({ minNights: "366" })).toEqual(["minNights"]);
  });

  it("relit une annonce existante dans le formulaire", () => {
    const listing: Listing = {
      id: "a",
      publicRef: "ref",
      kind: "long_term",
      category: "house",
      status: "draft",
      title: "Maison",
      description: null,
      city: null,
      neighbourhood: null,
      price: { amount: 98050, currency: "EUR" },
      priceUnit: "month",
      deposit: null,
      capacity: null,
      areaM2: 68,
      rooms: null,
      amenities: ["garden"],
      minNights: 30,
      cancellationPolicy: "strict",
      publishedAt: null,
      missing: ["city_id", "capacity"],
      lockVersion: 2,
    };
    expect(formFromListing(listing)).toMatchObject({ kind: "long_term", price: "980,50", capacity: "", areaM2: "68", minNights: "30", amenities: ["garden"], currency: "EUR" });
  });
});
