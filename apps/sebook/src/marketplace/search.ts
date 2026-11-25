import { z } from "zod";
import { isIsoDay } from "@/lib/dates";
import { categorySchema, sortSchema } from "./schemas";
import type { Category, Kind, Sort } from "./schemas";

export const DEFAULT_CURRENCY = "EUR";
export const PER_PAGE = 12;

export interface SearchState {
  scope: Kind;
  place: string;
  category: Category | null;
  guests: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  amenities: string[];
  sort: Sort;
  after: string | null;
  checkIn: string;
  checkOut: string;
}

export const EMPTY_SEARCH: SearchState = {
  scope: "short_stay",
  place: "",
  category: null,
  guests: null,
  minPrice: null,
  maxPrice: null,
  amenities: [],
  sort: "relevance",
  after: null,
  checkIn: "",
  checkOut: "",
};

type RawParams = Readonly<Record<string, string | string[] | undefined>>;

const SCOPE_PARAM = { short_stay: "sejours", long_term: "longue-duree" } as const;
const whole = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const placeSlug = z.string().regex(/^[a-z0-9-]{1,80}$/);
const amenityId = z.string().regex(/^[a-z][a-z_]{0,31}$/);
const cursor = z.string().regex(/^[A-Za-z0-9=_-]{1,512}$/);

function single(raw: RawParams, key: string): string | undefined {
  const value = raw[key];
  return Array.isArray(value) ? value[0] : value;
}

function pick<T>(schema: z.ZodType<T>, value: string | undefined): T | null {
  if (value === undefined) return null;
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function searchFromParams(raw: RawParams): SearchState {
  const scope = single(raw, "portee") === SCOPE_PARAM.long_term ? "long_term" : "short_stay";
  const amenities = (single(raw, "equipements") ?? "")
    .split(",")
    .map((id) => amenityId.safeParse(id))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []));
  const checkIn = single(raw, "arrivee") ?? "";
  const checkOut = single(raw, "depart") ?? "";
  const datesOk = isIsoDay(checkIn) && isIsoDay(checkOut) && checkOut > checkIn;
  return {
    scope,
    place: pick(placeSlug, single(raw, "place")) ?? "",
    category: pick(categorySchema, single(raw, "categorie")),
    guests: pick(whole(1, 30), single(raw, "voyageurs")),
    minPrice: pick(whole(0, 1_000_000), single(raw, "prix_min")),
    maxPrice: pick(whole(0, 1_000_000), single(raw, "prix_max")),
    amenities: [...new Set(amenities)].slice(0, 10),
    sort: pick(sortSchema, single(raw, "tri")) ?? "relevance",
    after: pick(cursor, single(raw, "apres")),
    checkIn: scope === "short_stay" && datesOk ? checkIn : "",
    checkOut: scope === "short_stay" && datesOk ? checkOut : "",
  };
}

export function searchToParams(state: SearchState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.scope === "long_term") params.set("portee", SCOPE_PARAM.long_term);
  if (state.place) params.set("place", state.place);
  if (state.category) params.set("categorie", state.category);
  if (state.guests !== null) params.set("voyageurs", String(state.guests));
  if (state.minPrice !== null) params.set("prix_min", String(state.minPrice));
  if (state.maxPrice !== null) params.set("prix_max", String(state.maxPrice));
  if (state.amenities.length > 0) params.set("equipements", state.amenities.join(","));
  if (state.sort !== "relevance") params.set("tri", state.sort);
  if (state.after) params.set("apres", state.after);
  if (state.checkIn && state.checkOut) {
    params.set("arrivee", state.checkIn);
    params.set("depart", state.checkOut);
  }
  return params;
}

export function searchHref(state: SearchState, path = "/destinations"): string {
  const query = searchToParams(state).toString();
  return query ? `${path}?${query}` : path;
}

export function withoutCursor(state: SearchState): SearchState {
  return { ...state, after: null };
}

export function apiListingParams(state: SearchState, toMinor: (major: number) => number): URLSearchParams {
  const params = new URLSearchParams();
  params.set("kind", state.scope);
  if (state.place) params.set("place", state.place);
  if (state.category) params.set("category", state.category);
  if (state.guests !== null) params.set("guests", String(state.guests));
  if (state.minPrice !== null) params.set("min_price", String(toMinor(state.minPrice)));
  if (state.maxPrice !== null) params.set("max_price", String(toMinor(state.maxPrice)));
  for (const id of state.amenities) params.append("amenities[]", id);
  params.set("sort", state.sort);
  params.set("per_page", String(PER_PAGE));
  if (state.after) params.set("after", state.after);
  return params;
}

export function hasActiveFilters(state: SearchState): boolean {
  return state.place !== "" || state.category !== null || state.guests !== null || state.minPrice !== null || state.maxPrice !== null || state.amenities.length > 0;
}
