import { describe, expect, it } from "vitest";
import { DETAIL, REF } from "@/marketplace/responses.fixtures";
import { listingDetailSchema } from "@/marketplace/schemas";
import { listingMetadata } from "./listingMetadata";

describe("listingMetadata", () => {
  it("décrit l’annonce : titre, description, canonique et Open Graph", () => {
    const meta = listingMetadata({ status: "found", value: listingDetailSchema.parse(DETAIL) });
    expect(meta.title).toBe("Studio lumineux, Presqu’île");
    expect(meta.description).toBe("Studio · Presqu’île, Lyon · 74 € par nuit. Studio de 28 m² au 3e étage avec ascenseur. Linge fourni.");
    expect(meta.alternates?.canonical).toBe(`/listings/${REF}`);
    expect(meta.openGraph).toMatchObject({ url: `/listings/${REF}`, title: "Studio lumineux, Presqu’île", siteName: "SeBook" });
    expect(meta.robots).toBeUndefined();
  });

  it("n’indexe pas une annonce absente (404)", () => {
    expect(listingMetadata({ status: "absent" }).robots).toEqual({ index: false, follow: true });
  });

  it("une panne de l’API (429, 5xx) ne passe jamais l’annonce en noindex", () => {
    const meta = listingMetadata({ status: "unavailable" });
    expect(meta.title).toBe("Annonce indisponible");
    expect(meta.robots).toBeUndefined();
  });
});
