import { z } from 'zod';
import type { ApiClient } from './client';

export const apiProfileSchema = z.object({
  space: z.enum(['tenant', 'owner', 'organization', 'operator']),
  label: z.string(),
  meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
});
export type ApiProfile = z.infer<typeof apiProfileSchema>;

export const organizationMetaSchema = z.object({
  organization: z.uuid(),
  kind: z.enum(['agency', 'individual']),
  role: z.enum(['owner', 'admin', 'manager', 'accountant']),
});
export type OrganizationProfile = z.infer<typeof organizationMetaSchema> & { name: string };

export async function listProfiles(client: ApiClient): Promise<ApiProfile[]> {
  const payload = z.object({ data: z.array(apiProfileSchema) }).parse(await client.get('/api/v1/me/profiles'));
  return payload.data;
}

export async function findOrganization(client: ApiClient, kind: OrganizationProfile['kind']): Promise<OrganizationProfile | null> {
  for (const profile of await listProfiles(client)) {
    if (profile.space !== 'organization') continue;
    const meta = organizationMetaSchema.safeParse(profile.meta);
    if (meta.success && meta.data.kind === kind) return { ...meta.data, name: profile.label };
  }
  return null;
}
