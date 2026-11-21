"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { detailKey, listKey, ownerKeys } from "../keys";
import { useOwnerSession } from "../session";
import { useCursorList } from "../shared/useCursorList";
import type { OwnerIntervention } from "./model";
import { decideApproval, fetchIntervention, fetchInterventionsPage } from "./requests";
import type { DecisionInput } from "./requests";

export function useInterventions(agency: string | null, enabled: boolean) {
  const { client } = useOwnerSession();
  return useCursorList<OwnerIntervention>(listKey("interventions", agency), (cursor) => fetchInterventionsPage(client, agency, cursor), enabled);
}

export function useIntervention(id: string) {
  const { client } = useOwnerSession();
  return useQuery({ queryKey: detailKey("intervention", id), queryFn: () => fetchIntervention(client, id) });
}

export function useDecideApproval(idempotencyKey: string) {
  const { client } = useOwnerSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DecisionInput) => decideApproval(client, input, idempotencyKey),
    onSettled: (_outcome, _error, input) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: detailKey("intervention", input.interventionId) }),
        queryClient.invalidateQueries({ queryKey: ownerKeys.interventions }),
      ]),
  });
}
