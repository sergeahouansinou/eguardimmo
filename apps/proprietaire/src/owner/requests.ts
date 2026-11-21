import type { ApiClient } from "@eguardimmo/api";
import type { z } from "zod";
import { UnexpectedResponseError } from "./errors";
import type { OwnerAccess, OwnerLink } from "./model";
import { agenciesSchema, linksSchema, meSchema } from "./schemas";

export const AGENCIES_PATH = "/api/v1/owner/agencies";
export const LINKS_PATH = "/api/v1/owner/links";
export const ME_PATH = "/api/v1/me";

function parse<S extends z.ZodType>(schema: S, payload: unknown): z.infer<S> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new UnexpectedResponseError();
  return parsed.data;
}

export async function fetchAgencies(client: ApiClient, agency?: string): Promise<OwnerAccess[]> {
  const response = parse(agenciesSchema, await client.get(AGENCIES_PATH, agency === undefined ? undefined : { agency }));
  return response.data.map((entry) => ({
    accessId: entry.access_id,
    role: entry.role,
    agencyId: entry.agency.id,
    agencyName: entry.agency.name,
    mandantName: entry.mandant.name,
    accessUntil: entry.access_until,
    inGrace: entry.in_grace,
    readOnly: entry.read_only,
  }));
}

export async function fetchLinks(client: ApiClient): Promise<OwnerLink[]> {
  const response = parse(linksSchema, await client.get(LINKS_PATH));
  return response.data.map((link) => ({
    id: link.id,
    role: link.role,
    agencyId: link.organization.id,
    agencyName: link.organization.name,
    mandantName: link.mandant.name,
    linkedAt: link.linked_at,
  }));
}

export async function detachLink(client: ApiClient, accessId: string): Promise<void> {
  await client.delete(`${LINKS_PATH}/${encodeURIComponent(accessId)}`);
}

export async function fetchMe(client: ApiClient): Promise<{ name: string; email: string }> {
  return parse(meSchema, await client.get(ME_PATH)).data;
}
