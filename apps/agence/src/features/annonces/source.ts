import type { ApiClient } from "@eguardimmo/api";
import { createOrgTransport } from "@/features/org/transport";
import type { Page } from "@/features/org/schemas";
import { listingResponse, listingsResponse } from "./schemas";
import type { Listing, ListingPayload, Status } from "./schemas";

export const LISTINGS_PER_PAGE = 25;

export interface AnnoncesSource {
  list: (status: Status | null, cursor: string | null) => Promise<Page<Listing>>;
  get: (id: string) => Promise<Listing>;
  create: (payload: ListingPayload) => Promise<Listing>;
  update: (id: string, lockVersion: number, payload: ListingPayload) => Promise<Listing>;
  publish: (id: string, lockVersion: number) => Promise<Listing>;
  archive: (id: string, lockVersion: number) => Promise<Listing>;
}

const MESSAGES: Readonly<Record<string, string>> = {
  role_forbidden: "Seuls le titulaire, les administrateurs et les gestionnaires de l’agence gèrent les annonces.",
  listing_not_found: "Cette annonce n’existe pas ou n’appartient pas à votre organisation.",
  listing_stale_version: "L’annonce a été modifiée depuis sa lecture : rechargez-la avant de renvoyer vos changements.",
  listing_archived: "Une annonce archivée ne se modifie plus : republiez-la d’abord.",
  listing_incomplete: "Pour publier, renseignez le titre, le prix, la ville et la capacité d’accueil.",
  listing_city_invalid: "La ville indiquée n’existe pas dans le référentiel.",
};

function body(payload: ListingPayload): Record<string, unknown> {
  return {
    ...(payload.kind === undefined ? {} : { kind: payload.kind }),
    category: payload.category,
    title: payload.title,
    description: payload.description,
    neighbourhood: payload.neighbourhood,
    price_minor: payload.priceMinor,
    currency: payload.currency,
    deposit_minor: payload.depositMinor,
    capacity: payload.capacity,
    area_m2: payload.areaM2,
    rooms: payload.rooms,
    amenities: payload.amenities,
    min_nights: payload.minNights,
    cancellation_policy: payload.cancellationPolicy,
  };
}

export function createApiAnnoncesSource(options: { client: ApiClient; organizationId: string | null }): AnnoncesSource {
  const transport = createOrgTransport(options.client, options.organizationId, { messages: MESSAGES, staleCodes: ["listing_stale_version"] });
  const path = (id: string) => `/listings/${encodeURIComponent(id)}`;
  return {
    list: (status, cursor) => transport.get("/listings", listingsResponse, { per_page: LISTINGS_PER_PAGE, cursor, status: status ?? undefined }),
    get: (id) => transport.get(path(id), listingResponse),
    create: (payload) => transport.post("/listings", listingResponse, body(payload)),
    update: (id, lockVersion, payload) => transport.patch(path(id), listingResponse, { lock_version: lockVersion, ...body(payload) }),
    publish: (id, lockVersion) => transport.post(`${path(id)}/publish`, listingResponse, { lock_version: lockVersion }),
    archive: (id, lockVersion) => transport.post(`${path(id)}/archive`, listingResponse, { lock_version: lockVersion }),
  };
}
