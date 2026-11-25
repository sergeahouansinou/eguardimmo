import { describe, expect, it } from "vitest";
import { listingJsonLd, serializeJsonLd } from "./jsonld";
import { DETAIL } from "./responses.fixtures";
import { listingDetailSchema } from "./schemas";

describe("JSON-LD", () => {
  it("échappe toute balise fermante issue d’un contenu utilisateur", () => {
    const hostile = { ...DETAIL, title: "</script><script>alert(1)</script>", description: "a b" };
    const json = serializeJsonLd(listingJsonLd(listingDetailSchema.parse(hostile), "https://sebook.test/annonces/x"));
    expect(json).not.toContain("</script>");
    expect(json).not.toContain("<");
    expect(json).not.toContain(" ");
    expect(JSON.parse(json)).toMatchObject({ name: "</script><script>alert(1)</script>" });
  });

  it("décrit l’annonce sans adresse exacte ni identifiant interne", () => {
    const data = listingJsonLd(listingDetailSchema.parse(DETAIL), "https://sebook.test/annonces/k3m7q9x2v8nb");
    expect(data).toMatchObject({
      "@type": "Accommodation",
      address: { addressLocality: "Lyon", postalCode: "69002" },
      offers: { price: "74.00", priceCurrency: "EUR" },
    });
    expect(Object.keys(data.address as object)).not.toContain("streetAddress");
    expect(JSON.stringify(data)).not.toMatch(/organization|unit_id|"id"/);
  });
});
