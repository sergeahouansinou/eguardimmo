import { z } from 'zod';

const id = z.string().min(1);
const count = z.number().int().nonnegative();
const isoDateTime = z.iso.datetime({ offset: true });
const side = z.enum(['agency', 'me', 'other']);

const attachment = z.object({ id, name: z.string().min(1), mime_type: z.string().min(1), size_bytes: count });

const message = z.object({
  id,
  client_id: z.string().nullable(),
  author: z.object({ side, name: z.string() }),
  mine: z.boolean(),
  body: z.string(),
  sent_at: isoDateTime,
  redacted: z.boolean(),
  attachments: z.array(attachment),
});

const reference = z.object({ id, reference: z.string().nullable() });

const thread = z.object({
  id,
  subject: z.string(),
  status: z.enum(['open', 'closed']),
  agency: z.object({ id, name: z.string().nullable() }),
  lease: reference.nullable(),
  mandate: reference.nullable(),
  preview: z.string(),
  last_message_at: isoDateTime,
  last_author: side,
  unread: z.boolean(),
  archived: z.boolean(),
  message_count: count,
  has_attachments: z.boolean(),
  agency_last_read_at: isoDateTime.nullable(),
  muted: z.boolean(),
  muted_until: isoDateTime.nullable(),
  can_reply: z.boolean(),
});

const cursorMeta = z.object({ has_more: z.boolean(), next_cursor: z.string().nullable() });

export type ThreadPayload = z.infer<typeof thread>;
export type MessagePayload = z.infer<typeof message>;

export const threadListPayload = z.object({ data: z.array(thread), meta: cursorMeta });
export const threadDetailPayload = z.object({ data: thread.extend({ messages: z.array(message), messages_meta: cursorMeta }) });
export const threadPayload = z.object({ data: thread });
export const messagePayload = z.object({ data: message });
export const messagesPayload = z.object({
  data: z.array(message),
  meta: cursorMeta.extend({
    status: z.enum(['open', 'closed']),
    agency_last_read_at: isoDateTime.nullable(),
    can_reply: z.boolean(),
  }),
});
export const unreadPayload = z.object({ data: z.object({ unread: count }) });
export const tenantOptionsPayload = z.object({
  data: z.array(z.object({ agency: z.object({ id, name: z.string().nullable() }), lease: reference })),
});
export const ownerOptionsPayload = z.object({
  data: z.array(z.object({ access_id: id, agency: z.object({ id, name: z.string().nullable() }), mandant_name: z.string().nullable() })),
});
