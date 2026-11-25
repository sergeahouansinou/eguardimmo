import type { ApiClient } from "@eguardimmo/api";
import { ZodError } from "zod";
import type { z } from "zod";
import { UnexpectedResponseError } from "./errors";
import {
  availabilityResponseSchema,
  bookingResponseSchema,
  bookingsPageSchema,
  favoritesPageSchema,
  listingResponseSchema,
  meSchema,
  placesResponseSchema,
  quoteResponseSchema,
} from "./schemas";
import type { Booking, ListingDetail, ListingSummary, OccupiedRange, Place, Quote } from "./schemas";

const MARKETPLACE = "/api/v1/marketplace";
const FAVORITES_PAGE_CAP = 5;

function parse<T>(schema: z.ZodType<T>, payload: unknown): T {
  try {
    return schema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError) throw new UnexpectedResponseError();
    throw error;
  }
}

const listingPath = (ref: string) => `${MARKETPLACE}/listings/${encodeURIComponent(ref)}`;

export async function fetchMe(client: ApiClient): Promise<{ name: string; verified: boolean }> {
  const { data } = parse(meSchema, await client.get("/api/v1/me"));
  return { name: data.name, verified: data.email_verified_at !== null };
}

export async function fetchPlaces(client: ApiClient, query: string): Promise<Place[]> {
  return parse(placesResponseSchema, await client.get(`${MARKETPLACE}/places`, { q: query })).data;
}

export async function fetchListingDetail(client: ApiClient, ref: string): Promise<ListingDetail> {
  return parse(listingResponseSchema, await client.get(listingPath(ref))).data;
}

export async function fetchAvailability(client: ApiClient, ref: string, from: string, to: string): Promise<OccupiedRange[]> {
  return parse(availabilityResponseSchema, await client.get(`${listingPath(ref)}/availability`, { from, to })).data;
}

export interface StayInput {
  checkIn: string;
  checkOut: string;
  guests: number;
}

export async function requestQuote(client: ApiClient, ref: string, stay: StayInput): Promise<Quote> {
  const body = { check_in: stay.checkIn, check_out: stay.checkOut, guests: stay.guests };
  return parse(quoteResponseSchema, await client.post(`${listingPath(ref)}/quote`, body)).data;
}

export interface VisitRequestInput {
  desiredSlot: string;
  message: string;
}

export async function sendVisitRequest(client: ApiClient, ref: string, input: VisitRequestInput): Promise<void> {
  await client.post(`${listingPath(ref)}/visit-requests`, { requested_slot: input.desiredSlot, message: input.message });
}

export async function fetchFavoriteRefs(client: ApiClient): Promise<ListingSummary[]> {
  const collected: ListingSummary[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < FAVORITES_PAGE_CAP; page += 1) {
    const result: z.infer<typeof favoritesPageSchema> = parse(favoritesPageSchema, await client.get(`${MARKETPLACE}/favorites`, { cursor }));
    collected.push(...result.data);
    cursor = result.meta.next_cursor;
    if (cursor === null) break;
  }
  return collected;
}

export async function addFavorite(client: ApiClient, ref: string): Promise<void> {
  await client.put(`${MARKETPLACE}/favorites/${encodeURIComponent(ref)}`);
}

export async function removeFavorite(client: ApiClient, ref: string): Promise<void> {
  await client.delete(`${MARKETPLACE}/favorites/${encodeURIComponent(ref)}`);
}

export interface CreateBookingInput extends StayInput {
  listingRef: string;
  idempotencyKey: string;
}

export async function createBooking(client: ApiClient, input: CreateBookingInput): Promise<Booking> {
  const body = {
    listing_ref: input.listingRef,
    check_in: input.checkIn,
    check_out: input.checkOut,
    guests: input.guests,
  };
  const response = await client.post(`${MARKETPLACE}/bookings`, body, { headers: { "Idempotency-Key": input.idempotencyKey } });
  return parse(bookingResponseSchema, response).data;
}

export interface BookingsPage {
  items: Booking[];
  nextCursor: string | null;
}

export async function fetchBookingsPage(client: ApiClient, cursor: string | null): Promise<BookingsPage> {
  const page = parse(bookingsPageSchema, await client.get(`${MARKETPLACE}/bookings`, { cursor }));
  return { items: page.data, nextCursor: page.meta.next_cursor };
}

export async function cancelBooking(client: ApiClient, id: string): Promise<Booking> {
  return parse(bookingResponseSchema, await client.post(`${MARKETPLACE}/bookings/${encodeURIComponent(id)}/cancel`)).data;
}

export async function logout(client: ApiClient): Promise<void> {
  await client.post("/auth/logout");
}
