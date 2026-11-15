import { z } from 'zod';

const id = z.string().min(1);
const count = z.number().int().nonnegative();
const isoDateTime = z.iso.datetime({ offset: true });

const personRef = z.object({ id, name: z.string().min(1) });

const attachment = z.object({
  id,
  name: z.string().min(1),
  mime_type: z.string().min(1),
  size_bytes: count,
});

const pagination = z.object({ total: count, current_page: z.number().int().positive(), per_page: z.number().int().positive() });

const envelope = <T extends z.ZodType>(schema: T) => z.object({ data: schema });

const ticketSpace = z.enum(['tenant', 'owner', 'organization', 'marketplace']);
const ticketStatus = z.enum(['open', 'waiting', 'resolved']);
const ticketPriority = z.enum(['high', 'normal', 'low']);
const ticketCategory = z.enum(['messaging', 'billing', 'account', 'documents', 'other']);

export type ApiTicketSpace = z.infer<typeof ticketSpace>;
export type ApiTicketStatus = z.infer<typeof ticketStatus>;
export type ApiTicketPriority = z.infer<typeof ticketPriority>;
export type ApiTicketCategory = z.infer<typeof ticketCategory>;

const ticketSummary = z.object({
  id,
  reference: z.string().min(1),
  subject: z.string().min(1),
  organization: z.string().nullable(),
  space: ticketSpace,
  requester: personRef,
  assignee: personRef.nullable(),
  priority: ticketPriority,
  status: ticketStatus,
  category: ticketCategory,
  created_at: isoDateTime,
  updated_at: isoDateTime,
  message_count: count,
});

const supportMessage = z.object({
  id,
  author: z.object({ id, name: z.string().min(1), support: z.boolean() }),
  body: z.string(),
  internal: z.boolean(),
  sent_at: isoDateTime,
  attachments: z.array(attachment),
});

const ticketDetail = ticketSummary.extend({
  first_response_at: isoDateTime.nullable(),
  messages: z.array(supportMessage),
  access: z.object({ reason: z.string(), granted_at: isoDateTime, expires_at: isoDateTime }).nullable(),
});

export type ApiTicketSummary = z.infer<typeof ticketSummary>;
export type ApiTicketDetail = z.infer<typeof ticketDetail>;

export const ticketSummaryListSchema = z.object({ data: z.array(ticketSummary) });
export const ticketDetailResponseSchema = envelope(ticketDetail);

export const consoleTicketListSchema = z.object({
  data: z.array(ticketSummary),
  meta: pagination,
  counts: z.object({ open: count, waiting: count, resolved: count, all: count }),
});

export const ticketStatsResponseSchema = envelope(
  z.object({
    open: count,
    open_high: count,
    waiting: count,
    resolved_30d: count,
    first_response_minutes: count.nullable(),
  }),
);

export const staffResponseSchema = envelope(z.array(personRef));

const conversationSummary = z.object({
  id,
  subject: z.string().min(1),
  counterpart: personRef.nullable(),
  preview: z.string(),
  last_message_at: isoDateTime,
  last_author_id: id,
  unread: z.boolean(),
  archived: z.boolean(),
  awaiting_reply: z.boolean(),
  message_count: count,
  has_attachments: z.boolean(),
});

const conversationDetail = conversationSummary.extend({
  viewer_id: id,
  participants: z.array(personRef),
  messages: z.array(
    z.object({ id, author_id: id, body: z.string(), sent_at: isoDateTime, attachments: z.array(attachment) }),
  ),
});

export type ApiConversationSummary = z.infer<typeof conversationSummary>;
export type ApiConversationDetail = z.infer<typeof conversationDetail>;

export const conversationListResponseSchema = z.object({
  data: z.array(conversationSummary),
  meta: pagination,
  viewer_id: id,
  counts: z.object({ all: count, unread: count, awaiting: count, sent: count, archived: count }),
});

export const conversationDetailResponseSchema = envelope(conversationDetail);

export const conversationStatsResponseSchema = envelope(z.object({ unread: count, stale: count }));

export const recipientsResponseSchema = envelope(z.array(z.object({ id, name: z.string().min(1), role: z.string() })));
