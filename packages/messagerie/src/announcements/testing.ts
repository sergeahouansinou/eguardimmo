export const ANNOUNCEMENT_ID = '0193a5e1-0000-7000-8000-0000000003a1';
export const SECOND_ANNOUNCEMENT_ID = '0193a5e1-0000-7000-8000-0000000003a2';
export const NOTIFICATION_ID = '0193a5e1-0000-7000-8000-0000000003b1';
export const AGENCY_ORG_ID = '0193a5e1-0000-7000-8000-0000000003c1';
export const ANNOUNCEMENT_ATTACHMENT_ID = '0193a5e1-0000-7000-8000-0000000003d1';

export interface AnnouncementFixture {
  id: string;
  notification_id: string;
  organization_id: string;
  organization_name: string;
  subject: string;
  body: string;
  content_purged: boolean;
  sent_at: string | null;
  read_at: string | null;
  unread: boolean;
  attachments: { id: string; name: string; size_bytes: number }[];
}

export function announcementFixture(overrides: Partial<AnnouncementFixture> = {}): AnnouncementFixture {
  return {
    id: ANNOUNCEMENT_ID,
    notification_id: NOTIFICATION_ID,
    organization_id: AGENCY_ORG_ID,
    organization_name: 'Agence des Tilleuls',
    subject: 'Coupure d’eau lundi',
    body: 'Bonjour Awa, une coupure d’eau est prévue lundi de 9 h à 12 h.',
    content_purged: false,
    sent_at: '2026-11-19T09:00:00+00:00',
    read_at: null,
    unread: true,
    attachments: [],
    ...overrides,
  };
}

export function readAnnouncementFixture(overrides: Partial<AnnouncementFixture> = {}): AnnouncementFixture {
  return announcementFixture({ read_at: '2026-11-19T10:00:00+00:00', unread: false, ...overrides });
}

export const announcementResponse = (announcement: AnnouncementFixture) => ({ data: announcement });

export function announcementListResponse(announcements: AnnouncementFixture[], extra: { next_cursor?: string | null } = {}) {
  return {
    data: announcements,
    links: { first: null, last: null, prev: null, next: null },
    meta: { path: 'https://api.test/api/v1/tenant/announcements', per_page: 25, next_cursor: extra.next_cursor ?? null, prev_cursor: null },
  };
}
