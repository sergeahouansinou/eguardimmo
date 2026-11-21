import { listProfiles } from '@eguardimmo/api';
import type { ApiClient, ApiProfile } from '@eguardimmo/api';
import { z } from 'zod';
import { UnexpectedResponseError } from './errors';
import { toLeaseDetail, toLeaseSummary, toLinks } from './mapping';
import type { LeaseDetail, LeasePage, TenantLink } from './model';
import { leaseDetailSchema, leasePageSchema, linksSchema, meSchema } from './schemas';

export function parse<S extends z.ZodType>(schema: S, payload: unknown): z.infer<S> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new UnexpectedResponseError();
  return parsed.data;
}

export const LEASES_PATH = '/api/v1/tenant/leases';
export const LINKS_PATH = '/api/v1/tenant/links';

export async function fetchTenantProfile(client: ApiClient): Promise<ApiProfile | null> {
  const profiles = await listProfiles(client).catch((error: unknown) => {
    if (error instanceof z.ZodError) throw new UnexpectedResponseError();
    throw error;
  });
  return profiles.find((profile) => profile.space === 'tenant') ?? null;
}

export async function fetchMe(client: ApiClient): Promise<{ name: string; email: string }> {
  return parse(meSchema, await client.get('/api/v1/me')).data;
}

export async function fetchLeasesPage(client: ApiClient, cursor: string | null): Promise<LeasePage> {
  const page = parse(leasePageSchema, await client.get(LEASES_PATH, { cursor }));
  return { items: page.data.map(toLeaseSummary), nextCursor: page.meta.next_cursor };
}

export async function fetchLease(client: ApiClient, id: string): Promise<LeaseDetail> {
  return toLeaseDetail(parse(leaseDetailSchema, await client.get(`${LEASES_PATH}/${encodeURIComponent(id)}`)).data);
}

export async function fetchLinks(client: ApiClient): Promise<TenantLink[]> {
  return toLinks(parse(linksSchema, await client.get(LINKS_PATH)));
}

export async function revokeLink(client: ApiClient, partyId: string): Promise<void> {
  await client.delete(`${LINKS_PATH}/${encodeURIComponent(partyId)}`);
}
