import type { Announcement, AnnouncementAttachment, AnnouncementPage } from './model';

export interface AnnouncementsSource {
  list: (cursor: string | null, perPage: number) => Promise<AnnouncementPage>;
  get: (id: string) => Promise<Announcement>;
  markRead: (id: string) => Promise<Announcement>;
  downloadAttachment: (id: string, attachment: Pick<AnnouncementAttachment, 'id' | 'name'>) => Promise<void>;
}
