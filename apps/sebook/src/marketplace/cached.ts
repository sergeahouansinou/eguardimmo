import { createBoundedCache } from "./boundedCache";
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

const LIMITS = { ttlMs: 300_000, maxEntries: 250 } as const;

const pages = createBoundedCache<CachedRead<ListingsResult>>(LIMITS);
const details = createBoundedCache<CachedRead<ListingDetail>>(LIMITS);

export function clearPublicReads(): void {
  pages.clear();
  details.clear();
}

// Un chargement qui lève n'est jamais mémorisé : un 429, un 5xx ou une réponse hors contrat ne doivent
// donc jamais sortir en valeur de retour. La clé est publique (référence, filtres) et ignore le visiteur,
// dont l'adresse ne sert qu'à lui imputer la lecture quand l'entrée manque.
export function readListingsPage(query: string, visitor: string | null): Promise<CachedRead<ListingsResult>> {
  return pages.read(query, async () => {
    const fetched = await getPublic("/listings", new URLSearchParams(query), visitor);
    if (fetched.status !== "ok") throw new UpstreamUnavailableError("liste");
    const parsed = listingsPageSchema.safeParse(fetched.json);
    if (!parsed.success) throw new UpstreamUnavailableError("liste hors contrat");
    return { status: "found", value: { items: parsed.data.data, nextCursor: parsed.data.meta.next_cursor } };
  });
}

export function readListingDetail(ref: string, visitor: string | null): Promise<CachedRead<ListingDetail>> {
  return details.read(ref, async () => {
    const fetched = await getPublic(`/listings/${ref}`, undefined, visitor);
    if (fetched.status === "absent") return { status: "absent" };
    if (fetched.status !== "ok") throw new UpstreamUnavailableError("annonce");
    const parsed = listingResponseSchema.safeParse(fetched.json);
    if (!parsed.success) throw new UpstreamUnavailableError("annonce hors contrat");
    return { status: "found", value: parsed.data.data };
  });
}
