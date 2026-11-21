import { z } from 'zod';

const id = z.string().min(1);
const count = z.number().int().nonnegative();
const isoDateTime = z.iso.datetime({ offset: true });
const status = z.enum(['open', 'waiting', 'resolved']);
const person = z.object({ id, name: z.string() });
const scope = z.enum(['settings', 'team', 'records', 'documents']);

const attachment = z.object({ id, name: z.string().min(1), mime_type: z.string().min(1), size_bytes: count });

const ticket = z.object({
  id,
  reference: z.string().min(1),
  subject: z.string(),
  organization: z.string().nullable(),
  organization_id: z.string().nullable(),
  space: z.enum(['tenant', 'owner', 'organization', 'marketplace']),
  requester: person,
  assignee: person.nullable(),
  priority: z.enum(['high', 'normal', 'low']),
  status,
  category: z.enum(['messaging', 'billing', 'account', 'documents', 'other']),
  created_at: isoDateTime,
  updated_at: isoDateTime,
  requester_last_read_at: isoDateTime.nullable(),
  support_last_read_at: isoDateTime.nullable(),
  message_count: count,
  first_response_overdue: z.boolean(),
});

const message = z.object({
  id,
  author: z.object({ id: z.string().nullable(), name: z.string(), support: z.boolean() }),
  body: z.string(),
  internal: z.boolean(),
  sent_at: isoDateTime,
  attachments: z.array(attachment),
});

const grant = z.object({
  id,
  ticket_id: id,
  organization_id: z.string().nullable(),
  kind: z.enum(['consent', 'emergency']),
  status: z.enum(['requested', 'active', 'refused', 'revoked', 'expired']),
  scopes: z.array(scope),
  reason: z.string(),
  emergency_basis: z.enum(['security_incident', 'legal_requisition']).nullable(),
  duration_hours: z.number().int().nullable(),
  operator: person,
  requested_at: isoDateTime.nullable(),
  decided_at: isoDateTime.nullable(),
  granted_at: isoDateTime.nullable(),
  expires_at: isoDateTime.nullable(),
  revoked_at: isoDateTime.nullable(),
  reviewed: z.boolean(),
  reviewed_at: isoDateTime.nullable(),
  read_count: count,
});

export type TicketPayload = z.infer<typeof ticket>;
export type MessagePayload = z.infer<typeof message>;
export type GrantPayload = z.infer<typeof grant>;

export const ticketListPayload = z.object({
  data: z.array(ticket),
  meta: z.object({ current_page: z.number().int().positive(), last_page: z.number().int().positive(), per_page: z.number().int().positive(), total: count }),
  counts: z.object({ open: count, waiting: count, resolved: count, all: count }),
});

export const ticketDetailPayload = z.object({
  data: ticket.extend({
    has_more: z.boolean(),
    first_response_at: isoDateTime.nullable(),
    messages: z.array(message),
    access_grants: z.array(grant),
  }),
});

export const messagesPayload = z.object({
  data: z.array(message),
  meta: z.object({ has_more: z.boolean(), status, requester_last_read_at: isoDateTime.nullable(), support_last_read_at: isoDateTime.nullable() }),
});

export const statsPayload = z.object({
  data: z.object({
    open: count,
    open_high: count,
    waiting: count,
    resolved_30d: count,
    first_response_minutes: count.nullable(),
    first_response_overdue: count,
  }),
});

export const staffPayload = z.object({ data: z.array(person) });
export const grantResponsePayload = z.object({ data: grant });
export const teamPayload = z.object({ data: z.array(z.object({ first_name: z.string(), last_name: z.string(), role: z.string() })) });
export const settingsPayload = z.object({ data: z.object({ id, name: z.string(), country: z.string(), currency: z.string() }) });
