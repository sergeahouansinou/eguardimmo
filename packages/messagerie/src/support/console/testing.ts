import { ATTACHMENT_ID, FIRST_MESSAGE_ID, GRANT_ID, ORGANIZATION_ID, REQUESTER_ID, SECOND_MESSAGE_ID, SECOND_TICKET_ID, TICKET_ID } from '../testing';

export { ATTACHMENT_ID, FIRST_MESSAGE_ID, GRANT_ID, ORGANIZATION_ID, REQUESTER_ID, SECOND_MESSAGE_ID, SECOND_TICKET_ID, TICKET_ID };
export const OPERATOR_ID = '0193a5e1-0000-7000-8000-0000000002a1';
export const OTHER_OPERATOR_ID = '0193a5e1-0000-7000-8000-0000000002a2';
export const NOTE_MESSAGE_ID = '0193a5e1-0000-7000-8000-0000000001d3';
export const SECOND_GRANT_ID = '0193a5e1-0000-7000-8000-0000000001f2';

export interface ConsoleTicketFixture {
  id: string;
  reference: string;
  subject: string;
  organization: string | null;
  organization_id: string | null;
  space: 'tenant' | 'owner' | 'organization' | 'marketplace';
  requester: { id: string; name: string };
  assignee: { id: string; name: string } | null;
  priority: 'high' | 'normal' | 'low';
  status: 'open' | 'waiting' | 'resolved';
  category: 'messaging' | 'billing' | 'account' | 'documents' | 'other';
  created_at: string;
  updated_at: string;
  requester_last_read_at: string | null;
  support_last_read_at: string | null;
  message_count: number;
  first_response_overdue: boolean;
}

export function consoleTicketFixture(overrides: Partial<ConsoleTicketFixture> = {}): ConsoleTicketFixture {
  return {
    id: TICKET_ID,
    reference: 'SUP-2026-0001',
    subject: 'Impossible d’inviter un gestionnaire',
    organization: 'Agence des Tilleuls',
    organization_id: ORGANIZATION_ID,
    space: 'organization',
    requester: { id: REQUESTER_ID, name: 'Awa Koffi' },
    assignee: null,
    priority: 'normal',
    status: 'open',
    category: 'account',
    created_at: '2026-11-19T09:00:00+00:00',
    updated_at: '2026-11-19T09:00:00+00:00',
    requester_last_read_at: '2026-11-19T09:00:00+00:00',
    support_last_read_at: null,
    message_count: 1,
    first_response_overdue: false,
    ...overrides,
  };
}

export interface ConsoleMessageFixture {
  id: string;
  author: { id: string | null; name: string; support: boolean };
  body: string;
  internal: boolean;
  sent_at: string;
  attachments: { id: string; name: string; mime_type: string; size_bytes: number }[];
}

export function requesterMessageFixture(overrides: Partial<ConsoleMessageFixture> = {}): ConsoleMessageFixture {
  return {
    id: FIRST_MESSAGE_ID,
    author: { id: REQUESTER_ID, name: 'Awa Koffi', support: false },
    body: 'Bonjour, l’invitation d’un gestionnaire échoue depuis ce matin.',
    internal: false,
    sent_at: '2026-11-19T09:00:00+00:00',
    attachments: [],
    ...overrides,
  };
}

export function replyMessageFixture(overrides: Partial<ConsoleMessageFixture> = {}): ConsoleMessageFixture {
  return requesterMessageFixture({
    id: SECOND_MESSAGE_ID,
    author: { id: OPERATOR_ID, name: 'Camille Martin', support: true },
    body: 'Bonjour, nous regardons cela.',
    sent_at: '2026-11-19T10:00:00+00:00',
    ...overrides,
  });
}

export function noteMessageFixture(overrides: Partial<ConsoleMessageFixture> = {}): ConsoleMessageFixture {
  return replyMessageFixture({ id: NOTE_MESSAGE_ID, body: 'Piste : quota d’invitations atteint.', internal: true, sent_at: '2026-11-19T10:05:00+00:00', ...overrides });
}

export interface ConsoleGrantFixture {
  id: string;
  ticket_id: string;
  organization_id: string | null;
  kind: 'consent' | 'emergency';
  status: 'requested' | 'active' | 'refused' | 'revoked' | 'expired';
  scopes: ('settings' | 'team' | 'records' | 'documents')[];
  reason: string;
  emergency_basis: 'security_incident' | 'legal_requisition' | null;
  duration_hours: number | null;
  operator: { id: string; name: string };
  requested_at: string | null;
  decided_at: string | null;
  granted_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  reviewed: boolean;
  reviewed_at: string | null;
  read_count: number;
}

export function consoleGrantFixture(overrides: Partial<ConsoleGrantFixture> = {}): ConsoleGrantFixture {
  return {
    id: GRANT_ID,
    ticket_id: TICKET_ID,
    organization_id: ORGANIZATION_ID,
    kind: 'consent',
    status: 'requested',
    scopes: ['settings', 'team'],
    reason: 'Diagnostiquer l’erreur d’invitation signalée dans la demande.',
    emergency_basis: null,
    duration_hours: 24,
    operator: { id: OPERATOR_ID, name: 'Camille Martin' },
    requested_at: '2026-11-19T10:10:00+00:00',
    decided_at: null,
    granted_at: null,
    expires_at: null,
    revoked_at: null,
    reviewed: false,
    reviewed_at: null,
    read_count: 0,
    ...overrides,
  };
}

export const consoleListResponse = (
  tickets: ConsoleTicketFixture[],
  counts = { open: tickets.length, waiting: 0, resolved: 0, all: tickets.length },
  meta: Partial<{ current_page: number; last_page: number; per_page: number; total: number }> = {},
) => ({
  data: tickets,
  links: { first: null, last: null, prev: null, next: null },
  meta: { current_page: 1, last_page: 1, per_page: 20, total: tickets.length, ...meta },
  counts,
});

export function consoleDetailResponse(
  ticket: ConsoleTicketFixture,
  messages: ConsoleMessageFixture[] = [requesterMessageFixture()],
  grants: ConsoleGrantFixture[] = [],
) {
  return {
    data: { ...ticket, message_count: messages.length, has_more: false, first_response_at: null, messages, access: null, access_grants: grants },
  };
}

export const consoleMessagesResponse = (
  messages: ConsoleMessageFixture[],
  meta: Partial<{ has_more: boolean; status: 'open' | 'waiting' | 'resolved'; requester_last_read_at: string | null; support_last_read_at: string | null }> = {},
) => ({ data: messages, meta: { has_more: false, status: 'open' as 'open' | 'waiting' | 'resolved', requester_last_read_at: null, support_last_read_at: null, ...meta } });

export const consoleStatsResponse = (overrides: Partial<{ open: number; open_high: number; waiting: number; resolved_30d: number; first_response_minutes: number | null; first_response_overdue: number }> = {}) => ({
  data: { open: 4, open_high: 1, waiting: 1, resolved_30d: 7, first_response_minutes: 135, first_response_overdue: 2, ...overrides },
});

export const consoleStaffResponse = {
  data: [
    { id: OPERATOR_ID, name: 'Camille Martin' },
    { id: OTHER_OPERATOR_ID, name: 'Hugo Bernard' },
  ],
};

export const consoleGrantResponse = (grant: ConsoleGrantFixture) => ({ data: grant });
export const consoleTeamResponse = { data: [{ first_name: 'Awa', last_name: 'Koffi', role: 'owner' }, { first_name: 'Paul', last_name: 'Diallo', role: 'manager' }] };
export const consoleSettingsResponse = { data: { id: ORGANIZATION_ID, name: 'Agence des Tilleuls', country: 'FR', currency: 'EUR' } };
export const accessRequiredProblem = { type: '/problems/support_access_required', title: 'Accès du support requis', status: 403, code: 'support_access_required', detail: 'Aucun accès valide ne couvre cette ressource.' };
