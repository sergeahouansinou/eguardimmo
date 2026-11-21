import type { ApiClient } from "@eguardimmo/api";
import type { z } from "zod";
import { UnexpectedOwnerAccessResponseError } from "./errors";
import { issuedInvitationSchema, ownerAccessStateSchema } from "./schemas";
import type { InvitePayload, IssuedInvitation, OwnerAccessState } from "./schemas";

function parse<S extends z.ZodType>(schema: S, payload: unknown): z.infer<S> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new UnexpectedOwnerAccessResponseError();
  return parsed.data;
}

export function ownerAccessPath(organizationId: string, partyId: string, accessId?: string): string {
  const base = `/api/v1/org/${encodeURIComponent(organizationId)}/parties/${encodeURIComponent(partyId)}/owner-access`;
  return accessId === undefined ? base : `${base}/${encodeURIComponent(accessId)}`;
}

export async function fetchOwnerAccess(client: ApiClient, organizationId: string, partyId: string): Promise<OwnerAccessState> {
  return parse(ownerAccessStateSchema, await client.get(ownerAccessPath(organizationId, partyId))).data;
}

export async function inviteOwner(client: ApiClient, organizationId: string, partyId: string, payload: InvitePayload): Promise<IssuedInvitation> {
  return parse(issuedInvitationSchema, await client.post(ownerAccessPath(organizationId, partyId), { ...payload })).data;
}

export async function revokeOwnerAccess(client: ApiClient, organizationId: string, partyId: string, accessId: string): Promise<void> {
  await client.delete(ownerAccessPath(organizationId, partyId, accessId));
}
