"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ownerKeys } from "../keys";
import { useOwnerSession } from "../session";
import type { NewPayoutRequest } from "./model";
import { confirmPayoutRequest, contestPayoutAccount, createPayoutRequest, fetchPayoutAccounts, withdrawPayoutRequest } from "./requests";

export function usePayoutAccounts() {
  const { client } = useOwnerSession();
  return useQuery({ queryKey: ownerKeys.payoutAccount, queryFn: () => fetchPayoutAccounts(client) });
}

function useRefreshing<V, R>(run: (variables: V) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    gcTime: 0,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ownerKeys.payoutAccount });
    },
  });
}

export function useCreatePayoutRequest() {
  const { client } = useOwnerSession();
  return useRefreshing((input: NewPayoutRequest) => createPayoutRequest(client, input));
}

export function useConfirmPayoutRequest(requestId: string) {
  const { client } = useOwnerSession();
  return useRefreshing((code: string) => confirmPayoutRequest(client, requestId, code));
}

export function useWithdrawPayoutRequest(requestId: string) {
  const { client } = useOwnerSession();
  return useRefreshing(() => withdrawPayoutRequest(client, requestId));
}

export function useContestPayoutAccount(accessId: string) {
  const { client } = useOwnerSession();
  return useRefreshing(() => contestPayoutAccount(client, accessId));
}
