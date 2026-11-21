import { z } from 'zod';

const id = z.string().min(1);
const isoDateTime = z.iso.datetime({ offset: true });

const announcement = z.object({
  id,
  notification_id: id,
  organization_id: id,
  organization_name: z.string(),
  subject: z.string(),
  body: z.string(),
  content_purged: z.boolean(),
  sent_at: isoDateTime.nullable(),
  read_at: isoDateTime.nullable(),
  unread: z.boolean(),
  attachments: z.array(z.object({ id, name: z.string().min(1), size_bytes: z.number().int().nonnegative() })),
});

export type AnnouncementPayload = z.infer<typeof announcement>;

export const announcementPayload = z.object({ data: announcement });

export const announcementListPayload = z.object({
  data: z.array(announcement),
  meta: z.object({ per_page: z.number().int().nonnegative(), next_cursor: z.string().nullable() }),
});
