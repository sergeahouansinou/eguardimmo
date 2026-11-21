export const TICKET_ID = '0193a5e1-0000-7000-8000-0000000001a1';
export const SECOND_TICKET_ID = '0193a5e1-0000-7000-8000-0000000001a2';
export const ORGANIZATION_ID = '0193a5e1-0000-7000-8000-0000000001b1';
export const REQUESTER_ID = '0193a5e1-0000-7000-8000-0000000001c1';
export const FIRST_MESSAGE_ID = '0193a5e1-0000-7000-8000-0000000001d1';
export const SECOND_MESSAGE_ID = '0193a5e1-0000-7000-8000-0000000001d2';
export const ATTACHMENT_ID = '0193a5e1-0000-7000-8000-0000000001e1';
export const GRANT_ID = '0193a5e1-0000-7000-8000-0000000001f1';
export const SECOND_GRANT_ID = '0193a5e1-0000-7000-8000-0000000001f2';

export interface SupportMessageFixture {
  id: string;
  author: { id: string | null; name: string; support: boolean };
  body: string;
  internal: boolean;
  sent_at: string;
  attachments: { id: string; name: string; mime_type: string; size_bytes: number }[];
}

export function supportMessageFixture(overrides: Partial<SupportMessageFixture> = {}): SupportMessageFixture {
  return {
    id: FIRST_MESSAGE_ID,
    author: { id: REQUESTER_ID, name: 'Awa Koffi', support: false },
    body: 'Bonjour, je ne retrouve pas ma quittance de novembre.',
    internal: false,
    sent_at: '2026-11-19T09:00:00+00:00',
    attachments: [],
    ...overrides,
  };
}

export function supportReplyFixture(overrides: Partial<SupportMessageFixture> = {}): SupportMessageFixture {
  return supportMessageFixture({
    id: SECOND_MESSAGE_ID,
    author: { id: null, name: 'Support eGuardImmo', support: true },
    body: 'Bonjour, la quittance est dans « Loyers ».',
    sent_at: '2026-11-19T10:00:00+00:00',
    ...overrides,
  });
}

export interface SupportTicketFixture {
  id: string;
  reference: string;
  subject: string;
  organization: string | null;
  space: 'tenant' | 'owner' | 'organization' | 'marketplace';
  requester: { id: string; name: string };
  assignee: { id: string | null; name: string } | null;
  priority: 'high' | 'normal' | 'low';
  status: 'open' | 'waiting' | 'resolved';
  category: 'messaging' | 'billing' | 'account' | 'documents' | 'other';
  created_at: string;
  updated_at: string;
  requester_last_read_at: string | null;
  support_last_read_at: string | null;
  message_count: number;
}

export function supportTicketFixture(overrides: Partial<SupportTicketFixture> = {}): SupportTicketFixture {
  return {
    id: TICKET_ID,
    reference: 'SUP-2026-0001',
    subject: 'Quittance de novembre introuvable',
    organization: null,
    space: 'tenant',
    requester: { id: REQUESTER_ID, name: 'Awa Koffi' },
    assignee: null,
    priority: 'normal',
    status: 'open',
    category: 'documents',
    created_at: '2026-11-19T09:00:00+00:00',
    updated_at: '2026-11-19T09:00:00+00:00',
    requester_last_read_at: '2026-11-19T09:00:00+00:00',
    support_last_read_at: null,
    message_count: 1,
    ...overrides,
  };
}

export const ticketListResponse = (tickets: SupportTicketFixture[]) => ({ data: tickets });

export function ticketDetailResponse(ticket: SupportTicketFixture, messages: SupportMessageFixture[] = [supportMessageFixture()]) {
  return { data: { ...ticket, message_count: messages.length, first_response_at: null, messages } };
}

export function ticketMessagesResponse(
  messages: SupportMessageFixture[],
  meta: Partial<{ has_more: boolean; status: 'open' | 'waiting' | 'resolved'; requester_last_read_at: string | null; support_last_read_at: string | null }> = {},
) {
  return { data: messages, meta: { has_more: false, status: 'open', requester_last_read_at: null, support_last_read_at: null, ...meta } };
}

export const statusResponse = (online = true) => ({
  data: {
    online,
    hours_label: 'Lun–ven 9 h – 18 h (Europe/Paris)',
    response_label: 'Réponse sous 1 jour ouvré',
    timezone: 'Europe/Paris',
    hours: [{ days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00' }],
  },
});

export interface AccessFixture {
  id: string;
  kind: 'consent' | 'emergency';
  status: 'requested' | 'active' | 'refused' | 'revoked' | 'expired';
  scopes: ('settings' | 'team' | 'records' | 'documents')[];
  reason: string;
  emergency_basis: 'security_incident' | 'legal_requisition' | null;
  ticket_reference: string;
  operator: string;
  duration_hours: number | null;
  requested_at: string | null;
  decided_at: string | null;
  granted_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  reviewed: boolean;
  read_count: number;
}

export function accessFixture(overrides: Partial<AccessFixture> = {}): AccessFixture {
  return {
    id: GRANT_ID,
    kind: 'consent',
    status: 'requested',
    scopes: ['settings', 'team'],
    reason: 'Diagnostiquer l’erreur d’affichage des rôles signalée dans la demande.',
    emergency_basis: null,
    ticket_reference: 'SUP-2026-0001',
    operator: 'Camille M.',
    duration_hours: 48,
    requested_at: '2026-11-19T09:30:00+00:00',
    decided_at: null,
    granted_at: null,
    expires_at: null,
    revoked_at: null,
    reviewed: false,
    read_count: 0,
    ...overrides,
  };
}

export const accessListResponse = (grants: AccessFixture[], meta: { has_more: boolean; next_cursor: string | null } = { has_more: false, next_cursor: null }) => ({
  data: grants,
  meta,
});

export const accessResponse = (grant: AccessFixture) => ({ data: grant });
