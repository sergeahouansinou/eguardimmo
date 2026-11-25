import { z } from "zod";
import type { SearchState } from "@/marketplace/search";

export interface FiltersDraft {
  guests: number;
  minPrice: string;
  maxPrice: string;
  amenities: string[];
  sort: SearchState["sort"];
}

export interface FiltersErrors {
  minPrice?: boolean;
  maxPrice?: boolean;
  range?: boolean;
}

export const FILTER_AMENITIES = ["wifi", "kitchen", "washer", "air_conditioning", "elevator", "parking", "pets_allowed"] as const;
export const GUEST_CHOICES = [0, 1, 2, 4, 6, 8] as const;

const amount = z.coerce.number().int().min(0).max(1_000_000);

export function draftFromSearch(search: SearchState): FiltersDraft {
  return {
    guests: search.guests ?? 0,
    minPrice: search.minPrice === null ? "" : String(search.minPrice),
    maxPrice: search.maxPrice === null ? "" : String(search.maxPrice),
    amenities: search.amenities,
    sort: search.sort,
  };
}

export function countActiveFilters(search: SearchState): number {
  return (search.guests !== null ? 1 : 0) + (search.minPrice !== null || search.maxPrice !== null ? 1 : 0) + search.amenities.length + (search.sort !== "relevance" ? 1 : 0);
}

export type ApplyResult = { ok: true; search: SearchState } | { ok: false; errors: FiltersErrors };

export function applyDraft(base: SearchState, draft: FiltersDraft): ApplyResult {
  const errors: FiltersErrors = {};
  const parse = (raw: string, key: "minPrice" | "maxPrice"): number | null => {
    if (raw.trim() === "") return null;
    const parsed = amount.safeParse(raw);
    if (parsed.success) return parsed.data;
    errors[key] = true;
    return null;
  };
  const minPrice = parse(draft.minPrice, "minPrice");
  const maxPrice = parse(draft.maxPrice, "maxPrice");
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) errors.range = true;
  if (errors.minPrice || errors.maxPrice || errors.range) return { ok: false, errors };
  return { ok: true, search: { ...base, guests: draft.guests > 0 ? draft.guests : null, minPrice, maxPrice, amenities: draft.amenities, sort: draft.sort, after: null } };
}
