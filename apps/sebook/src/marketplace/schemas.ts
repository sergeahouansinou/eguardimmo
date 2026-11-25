import { z } from "zod";

export const KINDS = ["short_stay", "long_term"] as const;
export const CATEGORIES = ["studio", "apartment", "house", "shared"] as const;
export const PRICE_UNITS = ["night", "month"] as const;
export const POLICIES = ["flexible", "moderate", "strict"] as const;
export const BOOKING_STATUSES = ["pending_payment", "confirmed", "cancelled", "completed"] as const;
export const SORTS = ["relevance", "price_asc", "price_desc", "recent"] as const;

export const kindSchema = z.enum(KINDS);
export const categorySchema = z.enum(CATEGORIES);
export const sortSchema = z.enum(SORTS);
export type Kind = z.infer<typeof kindSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Sort = z.infer<typeof sortSchema>;
export type CancellationPolicy = (typeof POLICIES)[number];

export const publicRefSchema = z.string().regex(/^[a-z2-9]{12}$/);
export const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const timestamp = z.iso.datetime({ offset: true });
const currency = z.string().regex(/^[A-Z]{3}$/);
const minor = z.number().int().nonnegative();

export const pageOf = <Item extends z.ZodType>(item: Item) =>
  z.object({ data: z.array(item), meta: z.object({ next_cursor: z.string().nullable() }) });
export const oneOf = <Item extends z.ZodType>(item: Item) => z.object({ data: item });

const moneyWire = z.object({ amount: minor, currency });
const cityWire = z.object({ slug: z.string(), name: z.string(), postal_code: z.string().nullable() });
const hostWire = z.object({ name: z.string().nullable() });

const cardWire = z.object({
  ref: publicRefSchema,
  kind: kindSchema,
  category: categorySchema,
  title: z.string(),
  city: cityWire.nullable(),
  neighbourhood: z.string().nullable(),
  price: moneyWire,
  price_unit: z.enum(PRICE_UNITS),
  capacity: z.number().int().positive(),
  area_m2: z.number().nullable(),
  rooms: z.number().int().nonnegative().nullable(),
  amenities: z.array(z.string()),
  min_nights: z.number().int().positive().nullable(),
  host: hostWire,
});

const publicListingWire = cardWire.extend({
  description: z.string(),
  deposit: moneyWire.nullable(),
  cancellation_policy: z.enum(POLICIES),
  published_at: timestamp.nullable(),
});

type CardWire = z.infer<typeof cardWire>;

function summaryOf(card: CardWire) {
  const { ref, price, host, city, ...rest } = card;
  return {
    ...rest,
    public_ref: ref,
    city: city === null ? null : { slug: city.slug, name: city.name, postal_code: city.postal_code },
    price_minor: price.amount,
    currency: price.currency,
    host: host.name === null ? null : { name: host.name },
  };
}

export const listingSummarySchema = cardWire.transform(summaryOf);
export type ListingSummary = z.output<typeof listingSummarySchema>;

export const listingDetailSchema = publicListingWire.transform((listing) => {
  const { deposit, description, cancellation_policy, published_at, ...card } = listing;
  return { ...summaryOf(card), description, cancellation_policy, deposit_minor: deposit?.amount ?? null, published_at };
});
export type ListingDetail = z.output<typeof listingDetailSchema>;

export const listingsPageSchema = pageOf(listingSummarySchema);
export const listingResponseSchema = oneOf(listingDetailSchema);

export const placeSchema = z.object({
  slug: z.string().min(1),
  name: z.string(),
  postal_code: z.string().nullable(),
  country: z.string(),
});
export type Place = z.infer<typeof placeSchema>;
export const placesResponseSchema = z.object({ data: z.array(placeSchema) });

export const availabilityResponseSchema = z.object({
  data: z.array(z.object({ check_in: isoDay, check_out: isoDay }).transform((range) => ({ from: range.check_in, to: range.check_out }))),
});
export type OccupiedRange = z.output<typeof availabilityResponseSchema>["data"][number];

export const quoteSchema = z
  .object({
    nights: z.number().int().positive(),
    nightly: moneyWire,
    subtotal: moneyWire,
    service_fee: moneyWire,
    total: moneyWire,
    cancellation_policy: z.enum(POLICIES),
    available: z.boolean(),
  })
  .transform((quote) => ({
    nights: quote.nights,
    nightly_minor: quote.nightly.amount,
    subtotal_minor: quote.subtotal.amount,
    service_fee_minor: quote.service_fee.amount,
    total_minor: quote.total.amount,
    currency: quote.total.currency,
    cancellation_policy: quote.cancellation_policy,
    available: quote.available,
  }));
export type Quote = z.output<typeof quoteSchema>;
export const quoteResponseSchema = oneOf(quoteSchema);

export const bookingSchema = z
  .object({
    id: z.uuid(),
    reference: z.string().regex(/^SB-\d{4}-\d{6}$/),
    status: z.enum(BOOKING_STATUSES),
    listing: z
      .object({ ref: publicRefSchema, title: z.string(), city: z.string().nullable(), neighbourhood: z.string().nullable(), host: hostWire })
      .nullable(),
    check_in: isoDay,
    check_out: isoDay,
    nights: z.number().int().positive(),
    guests: z.number().int().positive(),
    nightly: moneyWire,
    subtotal: moneyWire,
    service_fee: moneyWire,
    total: moneyWire,
    cancellation_policy: z.enum(POLICIES),
    expires_at: timestamp.nullable(),
    cancelled_at: timestamp.nullable(),
    refund: moneyWire.nullable(),
  })
  .transform((booking) => ({
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    listing:
      booking.listing === null
        ? null
        : { public_ref: booking.listing.ref, title: booking.listing.title, city: booking.listing.city, host: booking.listing.host.name === null ? null : { name: booking.listing.host.name } },
    check_in: booking.check_in,
    check_out: booking.check_out,
    nights: booking.nights,
    guests: booking.guests,
    nightly_minor: booking.nightly.amount,
    subtotal_minor: booking.subtotal.amount,
    service_fee_minor: booking.service_fee.amount,
    total_minor: booking.total.amount,
    currency: booking.total.currency,
    cancellation_policy: booking.cancellation_policy,
    expires_at: booking.expires_at,
    cancelled_at: booking.cancelled_at,
    refund_minor: booking.refund?.amount ?? null,
  }));
export type Booking = z.output<typeof bookingSchema>;
export const bookingResponseSchema = oneOf(bookingSchema);
export const bookingsPageSchema = pageOf(bookingSchema);

export const favoritesPageSchema = pageOf(listingSummarySchema);

export const meSchema = z.object({
  data: z.object({ name: z.string(), email_verified_at: z.string().nullable() }),
});
