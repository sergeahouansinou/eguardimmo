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

export const supportStatusResponseSchema = envelope(
  z.object({ online: z.boolean(), hours_label: z.string().min(1), response_label: z.string().min(1) }),
);
