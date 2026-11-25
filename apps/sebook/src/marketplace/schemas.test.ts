import { describe, expect, it } from "vitest";
import { bookingSchema, listingDetailSchema, listingSummarySchema, quoteSchema } from "./schemas";
import { BOOKING_CANCELLED, BOOKING_PENDING, DETAIL, QUOTE, REF, SUMMARY, SUMMARY_LONG } from "./responses.fixtures";

describe("schémas : forme réelle de l’API marketplace", () => {
  it("fiche d’annonce : ref, montants en objet, hôte", () => {
    expect(listingSummarySchema.parse(SUMMARY)).toMatchObject({
      public_ref: REF,
      city: { name: "Lyon", postal_code: "69002" },
      price_minor: 7400,
      currency: "EUR",
      host: { name: "Agence Rhône Immo" },
    });
    expect(listingDetailSchema.parse(DETAIL)).toMatchObject({ deposit_minor: 30000, cancellation_policy: "moderate" });
  });

  it("ville ou hôte absents : acceptés, représentés par null", () => {
    expect(listingSummarySchema.parse({ ...SUMMARY, city: null })).toMatchObject({ city: null });
    expect(listingSummarySchema.parse(SUMMARY_LONG)).toMatchObject({ host: null });
  });

  it("refuse une forme qui n’est pas celle de l’API (public_ref, price_minor)", () => {
    const { ref, ...rest } = SUMMARY;
    expect(ref).toBe(REF);
    expect(listingSummarySchema.safeParse({ ...rest, public_ref: REF }).success).toBe(false);
    expect(listingSummarySchema.safeParse({ ...SUMMARY, price: undefined, price_minor: 7400 }).success).toBe(false);
  });

  it("devis : montants en objet et drapeau available", () => {
    expect(quoteSchema.parse(QUOTE.data)).toMatchObject({ total_minor: 15300, available: true, cancellation_policy: "moderate" });
    expect(quoteSchema.safeParse({ ...QUOTE.data, available: undefined }).success).toBe(false);
  });

  it("réservation : remboursement en objet, annonce supprimée tolérée", () => {
    expect(bookingSchema.parse(BOOKING_CANCELLED)).toMatchObject({ refund_minor: 15300, status: "cancelled" });
    expect(bookingSchema.parse(BOOKING_PENDING)).toMatchObject({ refund_minor: null, listing: { public_ref: REF, city: "Lyon" } });
    expect(bookingSchema.parse({ ...BOOKING_PENDING, listing: null })).toMatchObject({ listing: null });
  });
});
