import { z } from "zod";
import { dataSchema, moneySchema, pageSchema } from "@/features/org/schemas";

export const KINDS = ["short_stay", "long_term"] as const;
export const CATEGORIES = ["studio", "apartment", "house", "shared"] as const;
export const STATUSES = ["draft", "published", "archived"] as const;
export const PRICE_UNITS = ["night", "month"] as const;
export const POLICIES = ["flexible", "moderate", "strict"] as const;
export const AMENITIES = ["wifi", "kitchen", "washer", "dishwasher", "air_conditioning", "heating", "parking", "elevator", "balcony", "terrace", "garden", "pool", "tv", "workspace", "pets_allowed", "step_free_access"] as const;

export type Kind = (typeof KINDS)[number];
export type Category = (typeof CATEGORIES)[number];
export type Status = (typeof STATUSES)[number];
export type PriceUnit = (typeof PRICE_UNITS)[number];
export type Policy = (typeof POLICIES)[number];
export type Amenity = (typeof AMENITIES)[number];

const listingApi = z.object({
  id: z.string().min(1),
  public_ref: z.string(),
  kind: z.enum(KINDS),
  category: z.enum(CATEGORIES),
  status: z.enum(STATUSES),
  title: z.string().nullable(),
  description: z.string().nullable(),
  city: z.object({ slug: z.string(), name: z.string(), postal_code: z.string().nullable() }).nullable(),
  city_id: z.string().nullable(),
  neighbourhood: z.string().nullable(),
  price: moneySchema.nullable(),
  price_unit: z.enum(PRICE_UNITS),
  deposit: moneySchema.nullable(),
  capacity: z.number().int().nullable(),
  area_m2: z.number().int().nullable(),
  rooms: z.number().int().nullable(),
  amenities: z.array(z.enum(AMENITIES)),
  min_nights: z.number().int(),
  cancellation_policy: z.enum(POLICIES),
  published_at: z.string().nullable(),
  missing_for_publication: z.array(z.string()),
  lock_version: z.number().int().min(1),
});

export const listingSchema = listingApi.transform((listing) => ({
  id: listing.id,
  publicRef: listing.public_ref,
  kind: listing.kind,
  category: listing.category,
  status: listing.status,
  title: listing.title,
  description: listing.description,
  city: listing.city === null ? null : { slug: listing.city.slug, name: listing.city.name, postalCode: listing.city.postal_code },
  neighbourhood: listing.neighbourhood,
  price: listing.price,
  priceUnit: listing.price_unit,
  deposit: listing.deposit,
  capacity: listing.capacity,
  areaM2: listing.area_m2,
  rooms: listing.rooms,
  amenities: listing.amenities,
  minNights: listing.min_nights,
  cancellationPolicy: listing.cancellation_policy,
  publishedAt: listing.published_at,
  missing: listing.missing_for_publication,
  lockVersion: listing.lock_version,
}));
export type Listing = z.output<typeof listingSchema>;

export const listingsResponse = pageSchema(listingSchema);
export const listingResponse = dataSchema(listingSchema);

export interface ListingPayload {
  kind?: Kind;
  category: Category;
  title: string;
  description: string | null;
  neighbourhood: string | null;
  priceMinor: number | null;
  currency: string;
  depositMinor: number | null;
  capacity: number | null;
  areaM2: number | null;
  rooms: number | null;
  amenities: Amenity[];
  minNights: number;
  cancellationPolicy: Policy;
}
