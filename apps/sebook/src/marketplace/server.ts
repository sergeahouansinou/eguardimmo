import { unstable_rethrow } from "next/navigation";
import { majorToMinor } from "@/lib/money";
import { DEFAULT_CURRENCY, EMPTY_SEARCH, apiListingParams } from "./search";
import type { SearchState } from "./search";
import { type CachedRead, type ListingsResult, readListingDetail, readListingsPage } from "./cached";
import { KINDS, publicRefSchema } from "./schemas";
import type { Kind, ListingDetail, ListingSummary } from "./schemas";

export type { ListingsResult };

export type Lookup<T> = { status: "found"; value: T } | { status: "absent" } | { status: "unavailable" };

export const SITEMAP_PER_PAGE = 24;

async function guarded<T>(read: () => Promise<CachedRead<T>>): Promise<Lookup<T>> {
  try {
    return await read();
  } catch (error) {
    unstable_rethrow(error);
    return { status: "unavailable" };
  }
}

export function fetchListings(search: SearchState, perPage?: number): Promise<Lookup<ListingsResult>> {
  const params = apiListingParams(search, (major) => majorToMinor(major, DEFAULT_CURRENCY));
  if (perPage !== undefined) params.set("per_page", String(perPage));
  return guarded(() => readListingsPage(params.toString()));
}

export function fetchListing(ref: string): Promise<Lookup<ListingDetail>> {
  if (!publicRefSchema.safeParse(ref).success) return Promise.resolve({ status: "absent" });
  return guarded(() => readListingDetail(ref));
}

const SITEMAP_PAGE_LIMIT = 40;

async function collectKind(scope: Kind): Promise<Lookup<ListingSummary[]>> {
  const collected: ListingSummary[] = [];
  let after: string | null = null;
  for (let page = 0; page < SITEMAP_PAGE_LIMIT; page += 1) {
    const result: Lookup<ListingsResult> = await fetchListings({ ...EMPTY_SEARCH, scope, sort: "recent", after }, SITEMAP_PER_PAGE);
    if (result.status !== "found") return { status: "unavailable" };
    collected.push(...result.value.items);
    after = result.value.nextCursor;
    if (after === null) break;
  }
  return { status: "found", value: collected };
}

export async function fetchAllListings(): Promise<Lookup<ListingSummary[]>> {
  const all: ListingSummary[] = [];
  for (const scope of KINDS) {
    const result = await collectKind(scope);
    if (result.status !== "found") return result;
    all.push(...result.value);
  }
  return { status: "found", value: [...new Map(all.map((listing) => [listing.public_ref, listing])).values()] };
}
