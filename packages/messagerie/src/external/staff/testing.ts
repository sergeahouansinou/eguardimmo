export const ORG_ID = '0193a5e1-0000-7000-8000-000000000001';
export const THREAD_ID = '0193a5e1-0000-7000-8000-0000000001a1';
export const TENANT_ID = '0193a5e1-0000-7000-8000-0000000001b1';
export const OWNER_PARTY_ID = '0193a5e1-0000-7000-8000-0000000001b2';
export const LEASE_ID = '0193a5e1-0000-7000-8000-0000000001c1';
export const MANDATE_ID = '0193a5e1-0000-7000-8000-0000000001c2';
export const STAFF_ID = '0193a5e1-0000-7000-8000-0000000001d1';
export const OTHER_STAFF_ID = '0193a5e1-0000-7000-8000-0000000001d2';
export const ATTACHMENT_ID = '0193a5e1-0000-7000-8000-0000000001e1';
export const FIRST_MESSAGE_ID = '0193a5e1-0000-7000-8000-0000000001f1';
export const SECOND_MESSAGE_ID = '0193a5e1-0000-7000-8000-0000000001f2';

export interface StaffMessageFixture {
  id: string;
  client_id: string | null;
  author: { id: string; name: string; side: 'staff' | 'tenant' | 'owner' };
  mine: boolean;
  body: string;
  sent_at: string;
  redacted: boolean;
  redaction_reason: string | null;
  attachments: { id: string; name: string; mime_type: string; size_bytes: number }[];
}

export function staffMessageFixture(overrides: Partial<StaffMessageFixture> = {}): StaffMessageFixture {
  return {
    id: FIRST_MESSAGE_ID,
    client_id: null,
    author: { id: TENANT_ID, name: 'Awa Koffi', side: 'tenant' },
    mine: false,
    body: 'Bonjour, pouvez-vous m’envoyer ma quittance ?',
    sent_at: '2026-11-19T09:00:00+00:00',
    redacted: false,
    redaction_reason: null,
    attachments: [],
    ...overrides,
  };
}

export function ownStaffMessageFixture(overrides: Partial<StaffMessageFixture> = {}): StaffMessageFixture {
  return staffMessageFixture({
    id: SECOND_MESSAGE_ID,
    client_id: '0193a5e1-0000-7000-8000-0000000001aa',
    author: { id: STAFF_ID, name: 'Camille Martin', side: 'staff' },
    mine: true,
    body: 'Elle arrive aujourd’hui.',
    sent_at: '2026-11-19T09:05:00+00:00',
    ...overrides,
  });
}

export interface StaffThreadFixture {
  id: string;
  kind: 'tenant' | 'owner';
  subject: string;
  status: 'open' | 'closed';
  closed_at: string | null;
  party: { id: string; name: string | null };
  lease: { id: string; reference: string | null } | null;
  mandate: { id: string; reference: string | null } | null;
  assignee: { id: string; name: string | null } | null;
  preview: string;
  last_message_at: string;
  last_author_side: 'staff' | 'tenant' | 'owner';
  last_author_name: string | null;
  unread: boolean;
  archived: boolean;
  awaiting_reply: boolean;
  message_count: number;
  has_attachments: boolean;
  counterpart_last_read_at: string | null;
  muted_until: string | null;
  muted_reason: string | null;
}

export function staffThreadFixture(overrides: Partial<StaffThreadFixture> = {}): StaffThreadFixture {
  return {
    id: THREAD_ID,
    kind: 'tenant',
    subject: 'Quittance de novembre',
    status: 'open',
    closed_at: null,
    party: { id: TENANT_ID, name: 'Awa Koffi' },
    lease: { id: LEASE_ID, reference: 'BAIL-2026-001' },
    mandate: null,
    assignee: null,
    preview: 'Bonjour, pouvez-vous m’envoyer ma quittance ?',
    last_message_at: '2026-11-19T09:00:00+00:00',
    last_author_side: 'tenant',
    last_author_name: 'Awa Koffi',
    unread: true,
    archived: false,
    awaiting_reply: true,
    message_count: 1,
    has_attachments: false,
    counterpart_last_read_at: null,
    muted_until: null,
    muted_reason: null,
    ...overrides,
  };
}

export interface StaffCursorMeta {
  has_more: boolean;
  next_cursor: string | null;
}

const NO_MORE: StaffCursorMeta = { has_more: false, next_cursor: null };
const COUNTS = { all: 1, awaiting: 1, unread: 1, sent: 0, archived: 0 };

export function staffListResponse(threads: StaffThreadFixture[], meta: Partial<StaffCursorMeta & { counts: typeof COUNTS }> = {}) {
  return { data: threads, meta: { ...NO_MORE, counts: COUNTS, ...meta } };
}

export function staffDetailResponse(thread: StaffThreadFixture, messages: StaffMessageFixture[] = [staffMessageFixture()], meta: StaffCursorMeta = NO_MORE) {
  return { data: { ...thread, messages, messages_meta: meta } };
}

export function staffMessagesResponse(
  messages: StaffMessageFixture[],
  meta: Partial<StaffCursorMeta & { status: 'open' | 'closed'; counterpart_last_read_at: string | null }> = {},
) {
  return { data: messages, meta: { ...NO_MORE, status: 'open', counterpart_last_read_at: null, ...meta } };
}

export const staffUnreadResponse = (counts: { internal?: number; tenant?: number; owner?: number } = {}) => ({
  data: { internal: 0, tenant: 0, owner: 0, ...counts },
});

export const staffRecipientsResponse = {
  data: [
    { id: OTHER_STAFF_ID, name: 'Zoé Adjovi', role: 'manager' },
    { id: '0193a5e1-0000-7000-8000-0000000001d3', name: 'Paul Compta', role: 'accountant' },
  ],
};

export const staffIdentityResponse = { data: { id: STAFF_ID, name: 'Camille Martin' } };
