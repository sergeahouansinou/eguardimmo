import type { z } from 'zod';
import type { Announcement, AnnouncementPage } from '../model';
import type { AnnouncementPayload, announcementListPayload } from './payloads';

export function toAnnouncement(payload: AnnouncementPayload): Announcement {
  return {
    id: payload.id,
    organizationId: payload.organization_id,
    organizationName: payload.organization_name,
    subject: payload.subject,
    body: payload.body,
    contentPurged: payload.content_purged,
    sentAt: payload.sent_at,
    readAt: payload.read_at,
    unread: payload.unread,
    attachments: payload.attachments.map((file) => ({ id: file.id, name: file.name, sizeBytes: file.size_bytes })),
  };
}

export function toAnnouncementPage(payload: z.infer<typeof announcementListPayload>): AnnouncementPage {
  return {
    items: payload.data.map(toAnnouncement),
    hasMore: payload.meta.next_cursor !== null,
    nextCursor: payload.meta.next_cursor,
  };
}
