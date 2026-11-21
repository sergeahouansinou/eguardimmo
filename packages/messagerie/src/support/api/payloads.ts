import { z } from 'zod';

const id = z.string().min(1);
const count = z.number().int().nonnegative();
const isoDateTime = z.iso.datetime({ offset: true });

const attachment = z.object({ id, name: z.string().min(1), mime_type: z.string().min(1), size_bytes: count });

const status = z.enum(['open', 'waiting', 'resolved']);

const ticket = z.object({
  id,
  reference: z.string().min(1),
  subject: z.string(),
  organization: z.string().nullable(),
  space: z.enum(['tenant', 'owner', 'organization', 'marketplace']),
  assignee: z.object({ id: z.string().nullable(), name: z.string() }).nullable(),
  status,
  category: z.enum(['messaging', 'billing', 'account', 'documents', 'other']),
  created_at: isoDateTime,
  updated_at: isoDateTime,
  requester_last_read_at: isoDateTime.nullable(),
  support_last_read_at: isoDateTime.nullable(),
  message_count: count,
});

const message = z.object({
  id,
  author: z.object({ id: z.string().nullable(), name: z.string(), support: z.boolean() }),
  body: z.string(),
  sent_at: isoDateTime,
  attachments: z.array(attachment),
});

export type TicketPayload = z.infer<typeof ticket>;
export type MessagePayload = z.infer<typeof message>;

export const ticketListPayload = z.object({ data: z.array(ticket) });
export const ticketDetailPayload = z.object({
  data: ticket.extend({ first_response_at: isoDateTime.nullable(), messages: z.array(message) }),
});
export const messagesPayload = z.object({
  data: z.array(message),
  meta: z.object({
    has_more: z.boolean(),
    status,
    requester_last_read_at: isoDateTime.nullable(),
    support_last_read_at: isoDateTime.nullable(),
  }),
});
export const availabilityPayload = z.object({
  data: z.object({
    online: z.boolean(),
    hours_label: z.string(),
    response_label: z.string(),
    timezone: z.string(),
    hours: z.array(z.object({ days: z.array(z.number().int()), from: z.string(), to: z.string() })),
  }),
});
