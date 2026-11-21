"use client";

import { useQuery } from "@tanstack/react-query";
import { detailKey, listKey } from "../keys";
import { useOwnerSession } from "../session";
import { useCursorList } from "../shared/useCursorList";
import type { OwnerLease } from "./model";
import { fetchLease, fetchLeasesPage } from "./requests";

export function useLeases(agency: string | null, enabled: boolean) {
  const { client } = useOwnerSession();
  return useCursorList<OwnerLease>(listKey("leases", agency), (cursor) => fetchLeasesPage(client, agency, cursor), enabled);
}

export function useLease(id: string) {
  const { client } = useOwnerSession();
  return useQuery({ queryKey: detailKey("lease", id), queryFn: () => fetchLease(client, id) });
}
