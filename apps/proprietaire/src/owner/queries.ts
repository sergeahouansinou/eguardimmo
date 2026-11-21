"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AGENCIES_STALE_MS, ownerKeys } from "./keys";
import type { OwnerAccess } from "./model";
import { detachLink, fetchAgencies, fetchLinks } from "./requests";
import { useOwnerSession } from "./session";

export function useAgencies() {
  const { client } = useOwnerSession();
  return useQuery({ queryKey: ownerKeys.agencies, queryFn: () => fetchAgencies(client), staleTime: AGENCIES_STALE_MS });
}

export function useLinks() {
  const { client } = useOwnerSession();
  return useQuery({ queryKey: ownerKeys.links, queryFn: () => fetchLinks(client) });
}

export function useDetach() {
  const { client } = useOwnerSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accessId: string) => detachLink(client, accessId),
    onSuccess: (_result, accessId) => {
      queryClient.setQueryData<OwnerAccess[]>(ownerKeys.agencies, (current) => current?.filter((access) => access.accessId !== accessId));
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ownerKeys.links }),
        queryClient.invalidateQueries({ queryKey: ownerKeys.agencies }),
      ]),
  });
}
