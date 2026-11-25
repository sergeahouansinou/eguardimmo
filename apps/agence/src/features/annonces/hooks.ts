"use client";

import { orgKey, useOrgInfinite, useOrgMutation, useOrgQuery } from "@/features/org/queries";
import { useAnnoncesSource } from "./AnnoncesSourceProvider";
import type { Listing, ListingPayload, Status } from "./schemas";

const MODULE = "annonces";

export function useListings(status: Status | null) {
  const source = useAnnoncesSource();
  return useOrgInfinite(orgKey(MODULE, "liste", status), (cursor) => source.list(status, cursor));
}

export function useListing(id: string) {
  const source = useAnnoncesSource();
  return useOrgQuery(orgKey(MODULE, "annonce", id), () => source.get(id));
}

export function useCreateListing() {
  const source = useAnnoncesSource();
  return useOrgMutation(MODULE, (payload: ListingPayload) => source.create(payload));
}

export function useUpdateListing() {
  const source = useAnnoncesSource();
  return useOrgMutation(MODULE, (input: { listing: Listing; payload: ListingPayload }) => source.update(input.listing.id, input.listing.lockVersion, input.payload));
}

export function usePublishListing() {
  const source = useAnnoncesSource();
  return useOrgMutation(MODULE, (listing: Listing) => source.publish(listing.id, listing.lockVersion));
}

export function useArchiveListing() {
  const source = useAnnoncesSource();
  return useOrgMutation(MODULE, (listing: Listing) => source.archive(listing.id, listing.lockVersion));
}
