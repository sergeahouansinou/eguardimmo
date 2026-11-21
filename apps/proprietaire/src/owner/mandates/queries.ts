"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { detailKey, listKey, ownerKeys } from "../keys";
import { useOwnerSession } from "../session";
import { useCursorList } from "../shared/useCursorList";
import type { OwnerMandate } from "./model";
import { cancelMandateEnd, fetchMandate, fetchMandatesPage, requestMandateEnd } from "./requests";

export function useMandates(agency: string | null, enabled: boolean) {
  const { client } = useOwnerSession();
  return useCursorList<OwnerMandate>(listKey("mandates", agency), (cursor) => fetchMandatesPage(client, agency, cursor), enabled);
}

export function useMandate(id: string | null) {
  const { client } = useOwnerSession();
  return useQuery({ queryKey: detailKey("mandate", id ?? ""), queryFn: () => fetchMandate(client, id ?? ""), enabled: id !== null });
}

function useRefreshing<V, R>(mandateId: string, run: (variables: V) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    gcTime: 0,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey("mandate", mandateId) });
      void queryClient.invalidateQueries({ queryKey: ownerKeys.mandates });
    },
  });
}

export function useRequestMandateEnd(mandateId: string) {
  const { client } = useOwnerSession();
  return useRefreshing(mandateId, (reason: string | null) => requestMandateEnd(client, mandateId, reason));
}

export function useCancelMandateEnd(mandateId: string) {
  const { client } = useOwnerSession();
  return useRefreshing(mandateId, () => cancelMandateEnd(client, mandateId));
}
