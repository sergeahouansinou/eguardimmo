"use client";

import { ApiError } from "@eguardimmo/api";
import { useOrganizationSession } from "@eguardimmo/shell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiMandatesSource } from "../../api/mandatesSource";
import { fetchOwnerAccess, inviteOwner, revokeOwnerAccess } from "./requests";
import type { InvitePayload } from "./schemas";

export const ownerAccessKeys = {
  state: (organizationId: string | null, partyId: string) => ["owner-access", organizationId, partyId] as const,
  contacts: (organizationId: string | null) => ["owner-access", organizationId, "contacts"] as const,
};

const FINAL_STATUSES: readonly number[] = [401, 403, 404, 422, 429];

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && FINAL_STATUSES.includes(error.status)) return false;
  return failureCount < 2;
}

function useContext() {
  const session = useOrganizationSession();
  return { client: session?.client ?? null, organizationId: session?.organization.organization ?? null };
}

export function useOwnerAccessState(partyId: string) {
  const { client, organizationId } = useContext();
  return useQuery({
    queryKey: ownerAccessKeys.state(organizationId, partyId),
    queryFn: () => {
      if (client === null || organizationId === null) throw new Error("Aucune organisation sélectionnée.");
      return fetchOwnerAccess(client, organizationId, partyId);
    },
    enabled: client !== null && organizationId !== null,
    retry: shouldRetry,
  });
}

export function useOwnerContacts(enabled: boolean) {
  const { client, organizationId } = useContext();
  return useQuery({
    queryKey: ownerAccessKeys.contacts(organizationId),
    queryFn: () => {
      if (client === null) throw new Error("Aucune organisation sélectionnée.");
      return createApiMandatesSource({ client, organizationId }).parties();
    },
    enabled: enabled && client !== null,
    retry: shouldRetry,
  });
}

export function useInviteOwner(partyId: string) {
  const { client, organizationId } = useContext();
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: (payload: InvitePayload) => {
      if (client === null || organizationId === null) throw new Error("Aucune organisation sélectionnée.");
      return inviteOwner(client, organizationId, partyId, payload);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerAccessKeys.state(organizationId, partyId) }),
  });
}

export function useRevokeOwnerAccess(partyId: string) {
  const { client, organizationId } = useContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accessId: string) => {
      if (client === null || organizationId === null) throw new Error("Aucune organisation sélectionnée.");
      return revokeOwnerAccess(client, organizationId, partyId, accessId);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ownerAccessKeys.state(organizationId, partyId) }),
  });
}
