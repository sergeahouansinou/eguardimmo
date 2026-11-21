import { z } from 'zod';

const id = z.string().min(1);
const count = z.number().int().nonnegative();
const isoDateTime = z.iso.datetime({ offset: true });
const side = z.enum(['staff', 'tenant', 'owner']);
const ref = z.object({ id, name: z.string().nullable() });
const link = z.object({ id, reference: z.string().nullable() });

const attachment = z.object({ id, name: z.string().min(1), mime_type: z.string().min(1), size_bytes: count });

const message = z.object({
  id,
  client_id: z.string().nullable(),
  author: z.object({ id, name: z.string(), side }),
  mine: z.boolean(),
  body: z.string(),
  sent_at: isoDateTime,
  redacted: z.boolean(),
  redaction_reason: z.string().nullable(),
  attachments: z.array(attachment),
});

const thread = z.object({
  id,
  kind: z.enum(['tenant', 'owner']),
  subject: z.string(),
  status: z.enum(['open', 'closed']),
  closed_at: isoDateTime.nullable(),
  party: ref,
  lease: link.nullable(),
  mandate: link.nullable(),
  assignee: ref.nullable(),
  preview: z.string(),
  last_message_at: isoDateTime,
  last_author_side: side,
  last_author_name: z.string().nullable(),
  unread: z.boolean(),
  archived: z.boolean(),
  awaiting_reply: z.boolean(),
  message_count: count,
  has_attachments: z.boolean(),
  counterpart_last_read_at: isoDateTime.nullable(),
  muted_until: isoDateTime.nullable(),
  muted_reason: z.string().nullable(),
});

const cursorMeta = z.object({ has_more: z.boolean(), next_cursor: z.string().nullable() });
const counts = z.object({ all: count, awaiting: count, unread: count, sent: count, archived: count });

export type StaffThreadPayload = z.infer<typeof thread>;
export type StaffMessagePayload = z.infer<typeof message>;

export const staffListPayload = z.object({ data: z.array(thread), meta: cursorMeta.extend({ counts }) });
export const staffDetailPayload = z.object({ data: thread.extend({ messages: z.array(message), messages_meta: cursorMeta }) });
export const staffMessagePayload = z.object({ data: message });
export const staffMessagesPayload = z.object({
  data: z.array(message),
  meta: cursorMeta.extend({ status: z.enum(['open', 'closed']), counterpart_last_read_at: isoDateTime.nullable() }),
});
export const staffUnreadPayload = z.object({ data: z.object({ internal: count, tenant: count, owner: count }) });
export const assigneesPayload = z.object({
  data: z.array(z.object({ id, name: z.string(), role: z.enum(['owner', 'admin', 'manager', 'accountant']) })),
});
export const identityPayload = z.object({ data: z.object({ id, name: z.string().min(1) }) });
