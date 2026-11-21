import { z } from 'zod';
import { ACCESS_STATUSES } from '../model';

const id = z.guid();

export const apiTenantAccessSchema = z.object({
  party_id: id,
  status: z.enum(ACCESS_STATUSES),
  email_hint: z.string().nullable(),
  expires_at: z.iso.datetime({ offset: true }).nullable(),
  linked_at: z.iso.datetime({ offset: true }).nullable(),
});

export const apiTenantAccessResponse = z.object({ data: apiTenantAccessSchema });

export const apiPartySummarySchema = z.object({
  id,
  kind: z.enum(['person', 'company']),
  display_name: z.string(),
  primary_email: z.string().nullable(),
  is_anonymized: z.boolean(),
  archived_at: z.string().nullable(),
});

export const apiPartyPage = z.object({ data: z.array(apiPartySummarySchema), meta: z.object({ per_page: z.number().int().nonnegative(), next_cursor: z.string().nullable() }) });

export const apiNoContent = z.null();

export type ApiTenantAccess = z.infer<typeof apiTenantAccessSchema>;
export type ApiPartySummary = z.infer<typeof apiPartySummarySchema>;
