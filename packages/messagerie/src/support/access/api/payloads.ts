import { z } from 'zod';

const isoDateTime = z.iso.datetime({ offset: true });

const grant = z.object({
  id: z.string().min(1),
  kind: z.enum(['consent', 'emergency']),
  status: z.enum(['requested', 'active', 'refused', 'revoked', 'expired']),
  scopes: z.array(z.enum(['settings', 'team', 'records', 'documents'])),
  reason: z.string(),
  emergency_basis: z.enum(['security_incident', 'legal_requisition']).nullable(),
  ticket_reference: z.string(),
  operator: z.string(),
  duration_hours: z.number().int().nullable(),
  requested_at: isoDateTime.nullable(),
  decided_at: isoDateTime.nullable(),
  granted_at: isoDateTime.nullable(),
  expires_at: isoDateTime.nullable(),
  revoked_at: isoDateTime.nullable(),
  reviewed: z.boolean(),
  read_count: z.number().int().nonnegative(),
});

export type GrantPayload = z.infer<typeof grant>;

export const grantListPayload = z.object({
  data: z.array(grant),
  meta: z.object({ has_more: z.boolean(), next_cursor: z.string().nullable() }),
});
export const grantPayload = z.object({ data: grant });
