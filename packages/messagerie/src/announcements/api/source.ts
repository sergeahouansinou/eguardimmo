import type { ApiClient } from '@eguardimmo/api';
import { saveBlob } from '../../data/api/attachmentDownload';
import { fetchAttachment, parsePayload, safeFileName } from '../../external/api/transport';
import type { ExternalSpace } from '../../external/model';
import type { AnnouncementsSource } from '../source';
import { toAnnouncement, toAnnouncementPage } from './mapping';
import { announcementListPayload, announcementPayload } from './payloads';

export interface AnnouncementsApiSourceOptions {
  client: ApiClient;
  space: ExternalSpace;
  fetchImpl?: typeof fetch;
}

export function createAnnouncementsApiSource({ client, space, fetchImpl = (...args) => fetch(...args) }: AnnouncementsApiSourceOptions): AnnouncementsSource {
  const root = `/api/v1/${space}/announcements`;
  const one = (id: string) => `${root}/${encodeURIComponent(id)}`;
  return {
    list: async (cursor, perPage) => toAnnouncementPage(parsePayload(announcementListPayload, await client.get(root, { per_page: perPage, cursor }))),
    get: async (id) => toAnnouncement(parsePayload(announcementPayload, await client.get(one(id))).data),
    markRead: async (id) => toAnnouncement(parsePayload(announcementPayload, await client.post(`${one(id)}/read`, {})).data),
    downloadAttachment: async (id, attachment) => {
      const blob = await fetchAttachment(client, fetchImpl, `${one(id)}/attachments/${encodeURIComponent(attachment.id)}`);
      saveBlob(blob, safeFileName(attachment.name));
    },
  };
}
