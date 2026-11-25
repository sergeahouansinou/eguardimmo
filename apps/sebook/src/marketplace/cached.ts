import { cacheLife } from "next/cache";
import { listingResponseSchema, listingsPageSchema } from "./schemas";
import type { ListingDetail, ListingSummary } from "./schemas";
import { getPublic } from "./upstream";

export interface ListingsResult {
  items: ListingSummary[];
  nextCursor: string | null;
}

export type CachedRead<T> = { status: "found"; value: T } | { status: "absent" };

export class UpstreamUnavailableError extends Error {
  constructor(what: string) {
    super(`Lecture publique indisponible : ${what}`);
  }
}

const PUBLIC_READ_LIFE = { stale: 60, revalidate: 300, expire: 3600 } as const;

// Une fonction « use cache » qui lève n'est jamais mémorisée : un 429, un 5xx ou une réponse hors
// contrat ne doivent donc jamais sortir en valeur de retour. Les arguments sont publics (référence,
// filtres), jamais de cookie ni de donnée liée à un utilisateur.
export async function readListingsPage(query: string): Promise<CachedRead<ListingsResult>> {
  "use cache";
  cacheLife(PUBLIC_READ_LIFE);
  const fetched = await getPublic("/listings", new URLSearchParams(query));
  if (fetched.status !== "ok") throw new UpstreamUnavailableError("liste");
  const parsed = listingsPageSchema.safeParse(fetched.json);
  if (!parsed.success) throw new UpstreamUnavailableError("liste hors contrat");
  return { status: "found", value: { items: parsed.data.data, nextCursor: parsed.data.meta.next_cursor } };
}

export async function readListingDetail(ref: string): Promise<CachedRead<ListingDetail>> {
  "use cache";
  cacheLife(PUBLIC_READ_LIFE);
  const fetched = await getPublic(`/listings/${ref}`);
  if (fetched.status === "absent") return { status: "absent" };
  if (fetched.status !== "ok") throw new UpstreamUnavailableError("annonce");
  const parsed = listingResponseSchema.safeParse(fetched.json);
  if (!parsed.success) throw new UpstreamUnavailableError("annonce hors contrat");
  return { status: "found", value: parsed.data.data };
}
