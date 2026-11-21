import type { CampaignAttachment } from '../campaigns/model';

export type AnnouncementAttachment = CampaignAttachment;

export interface Announcement {
  id: string;
  organizationId: string;
  organizationName: string;
  subject: string;
  body: string;
  contentPurged: boolean;
  sentAt: string | null;
  readAt: string | null;
  unread: boolean;
  attachments: AnnouncementAttachment[];
}

export interface AnnouncementPage {
  items: Announcement[];
  hasMore: boolean;
  nextCursor: string | null;
}

export const ANNOUNCEMENTS_PER_PAGE = 25;
export const UNREAD_SAMPLE_SIZE = 50;

export function countUnread(items: readonly Announcement[]): number {
  return items.filter((item) => item.unread).length;
}
