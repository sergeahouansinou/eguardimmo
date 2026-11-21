export const THREAD_ID = '0193a5e1-0000-7000-8000-0000000000a1';
export const SECOND_THREAD_ID = '0193a5e1-0000-7000-8000-0000000000a2';
export const AGENCY_ID = '0193a5e1-0000-7000-8000-0000000000b1';
export const LEASE_ID = '0193a5e1-0000-7000-8000-0000000000c1';
export const ACCESS_ID = '0193a5e1-0000-7000-8000-0000000000d1';
export const ATTACHMENT_ID = '0193a5e1-0000-7000-8000-0000000000e1';
export const FIRST_MESSAGE_ID = '0193a5e1-0000-7000-8000-0000000000f1';
export const SECOND_MESSAGE_ID = '0193a5e1-0000-7000-8000-0000000000f2';

export interface MessageFixture {
  id: string;
  client_id: string | null;
  author: { side: 'agency' | 'me' | 'other'; name: string };
  mine: boolean;
  body: string;
  sent_at: string;
  redacted: boolean;
  attachments: { id: string; name: string; mime_type: string; size_bytes: number }[];
}

export function messageFixture(overrides: Partial<MessageFixture> = {}): MessageFixture {
  return {
    id: FIRST_MESSAGE_ID,
    client_id: null,
    author: { side: 'agency', name: 'Camille Martin' },
    mine: false,
    body: 'Bonjour, votre quittance est disponible.',
    sent_at: '2026-11-19T09:00:00+00:00',
    redacted: false,
    attachments: [],
    ...overrides,
  };
}

export function ownMessageFixture(overrides: Partial<MessageFixture> = {}): MessageFixture {
  return messageFixture({
    id: SECOND_MESSAGE_ID,
    client_id: '0193a5e1-0000-7000-8000-0000000000aa',
    author: { side: 'me', name: 'Awa Koffi' },
    mine: true,
    body: 'Merci, je la télécharge.',
    sent_at: '2026-11-19T09:05:00+00:00',
    ...overrides,
  });
}

export interface ThreadFixture {
  id: string;
  subject: string;
  status: 'open' | 'closed';
  agency: { id: string; name: string | null };
  lease: { id: string; reference: string | null } | null;
  mandate: { id: string; reference: string | null } | null;
  preview: string;
  last_message_at: string;
  last_author: 'agency' | 'me' | 'other';
  unread: boolean;
  archived: boolean;
  message_count: number;
  has_attachments: boolean;
  agency_last_read_at: string | null;
  muted: boolean;
  muted_until: string | null;
  can_reply: boolean;
}

export function threadFixture(overrides: Partial<ThreadFixture> = {}): ThreadFixture {
  return {
    id: THREAD_ID,
    subject: 'Quittance de novembre',
    status: 'open',
    agency: { id: AGENCY_ID, name: 'Agence des Tilleuls' },
    lease: { id: LEASE_ID, reference: 'BAIL-2026-001' },
    mandate: null,
    preview: 'Bonjour, votre quittance est disponible.',
    last_message_at: '2026-11-19T09:00:00+00:00',
    last_author: 'agency',
    unread: true,
    archived: false,
    message_count: 1,
    has_attachments: false,
    agency_last_read_at: null,
    muted: false,
    muted_until: null,
    can_reply: true,
    ...overrides,
  };
}

export interface CursorMetaFixture {
  has_more: boolean;
  next_cursor: string | null;
}

export function listResponse(threads: ThreadFixture[], meta: CursorMetaFixture = { has_more: false, next_cursor: null }) {
  return { data: threads, meta };
}

export function detailResponse(thread: ThreadFixture, messages: MessageFixture[] = [messageFixture()], meta: CursorMetaFixture = { has_more: false, next_cursor: null }) {
  return { data: { ...thread, messages, messages_meta: meta } };
}

export function messagesResponse(
  messages: MessageFixture[],
  meta: Partial<CursorMetaFixture & { status: 'open' | 'closed'; agency_last_read_at: string | null; can_reply: boolean }> = {},
) {
  return { data: messages, meta: { has_more: false, next_cursor: null, status: 'open', agency_last_read_at: null, can_reply: true, ...meta } };
}

export const unreadResponse = (unread: number) => ({ data: { unread } });

export const tenantOptionsResponse = {
  data: [{ agency: { id: AGENCY_ID, name: 'Agence des Tilleuls' }, lease: { id: LEASE_ID, reference: 'BAIL-2026-001' } }],
};

export const ownerOptionsResponse = {
  data: [{ access_id: ACCESS_ID, agency: { id: AGENCY_ID, name: 'Cabinet Delmas' }, mandant_name: 'Indivision Roux' }],
};

export const problem = (status: number, code: string, detail = 'Détail serveur') => ({ status, body: { code, title: code, detail } });
