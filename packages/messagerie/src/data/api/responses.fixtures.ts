const ORG = '0b5f2c1e-6d7a-4c8e-9a41-2f6d8e7c1a10';
export const IDS = {
  org: ORG,
  me: '5d1c9a3e-1b2f-4f60-8a77-3c4d5e6f7a81',
  colleague: '8e2a4b6c-9d1f-4a3b-b5c7-0d1e2f3a4b52',
  ticket: '3a7e9c15-4b2d-4e8f-a6c1-9b0d2e4f6a73',
  conversation: 'c4d6e8f0-2a4c-4e6a-8c0e-1a3c5e7a9b24',
  operator: '9f1e3d5b-7a9c-4b1d-8f3a-5c7e9a1b3d65',
};

const piece = { id: 'a1b2c3d4-0000-4000-8000-00000000a001', name: 'quittance.pdf', mime_type: 'application/pdf', size_bytes: 20480 };

export const conversationSummary = {
  id: IDS.conversation,
  subject: 'Fuite au 3e étage',
  counterpart: { id: IDS.colleague, name: 'Marc Chevalier' },
  preview: 'Peux-tu passer ?',
  last_message_at: '2026-11-14T09:30:00+00:00',
  last_author_id: IDS.colleague,
  unread: true,
  archived: false,
  awaiting_reply: true,
  message_count: 2,
  has_attachments: true,
};

export const conversationListResponse = {
  data: [conversationSummary, { ...conversationSummary, id: 'c4d6e8f0-2a4c-4e6a-8c0e-1a3c5e7a9b25', counterpart: null, unread: false, awaiting_reply: false, last_author_id: IDS.me }],
  links: { first: 'x', last: 'x', prev: null, next: null },
  meta: { current_page: 1, from: 1, last_page: 1, path: 'x', per_page: 20, to: 2, total: 2, links: [] },
  viewer_id: IDS.me,
  counts: { all: 2, unread: 1, awaiting: 1, sent: 1, archived: 0 },
};

export const conversationDetailResponse = {
  data: {
    ...conversationSummary,
    viewer_id: IDS.me,
    participants: [
      { id: IDS.me, name: 'Awa Diallo' },
      { id: IDS.colleague, name: 'Marc Chevalier' },
    ],
    messages: [
      { id: 'm1000000-0000-4000-8000-000000000001', author_id: IDS.me, body: 'Fuite signalée.', sent_at: '2026-11-14T08:00:00+00:00', attachments: [] },
      { id: 'm1000000-0000-4000-8000-000000000002', author_id: IDS.colleague, body: 'Peux-tu passer ?', sent_at: '2026-11-14T09:30:00+00:00', attachments: [piece] },
    ],
  },
};

export const conversationStatsResponse = { data: { unread: 3, stale: 2 } };

export const recipientsResponse = { data: [{ id: IDS.colleague, name: 'Marc Chevalier', role: 'manager' }] };

export const ticketSummary = {
  id: IDS.ticket,
  reference: 'SUP-2026-00001',
  subject: 'Quittance introuvable',
  organization: 'Agence du Port',
  space: 'organization',
  requester: { id: IDS.me, name: 'Awa Diallo' },
  assignee: { id: IDS.operator, name: 'Ops Support' },
  priority: 'high',
  status: 'waiting',
  category: 'documents',
  created_at: '2026-11-13T08:00:00+00:00',
  updated_at: '2026-11-13T10:15:00+00:00',
  message_count: 2,
};

export const ticketDetailResponse = {
  data: {
    ...ticketSummary,
    first_response_at: '2026-11-13T10:15:00+00:00',
    messages: [
      { id: 't1000000-0000-4000-8000-000000000001', author: { id: IDS.me, name: 'Awa Diallo', support: false }, body: 'Je ne trouve pas ma quittance.', internal: false, sent_at: '2026-11-13T08:00:00+00:00', attachments: [piece] },
      { id: 't1000000-0000-4000-8000-000000000002', author: { id: IDS.operator, name: 'Ops Support', support: true }, body: 'Nous regardons.', internal: false, sent_at: '2026-11-13T10:15:00+00:00', attachments: [] },
      { id: 't1000000-0000-4000-8000-000000000003', author: { id: IDS.operator, name: 'Ops Support', support: true }, body: 'Note interne', internal: true, sent_at: '2026-11-13T10:20:00+00:00', attachments: [] },
    ],
    access: { reason: 'Vérifier la quittance manquante de mars', granted_at: '2026-11-13T10:30:00+00:00', expires_at: '2026-11-13T11:30:00+00:00' },
  },
};

export const myTicketListResponse = {
  data: [{ ...ticketSummary, organization: null, space: 'tenant', assignee: null, priority: 'normal', status: 'open', category: 'billing', message_count: 1 }],
};

export const consoleTicketListResponse = {
  data: [ticketSummary],
  links: { first: 'x', last: 'x', prev: null, next: null },
  meta: { current_page: 1, from: 1, last_page: 1, path: 'x', per_page: 20, to: 1, total: 1, links: [] },
  counts: { open: 4, waiting: 1, resolved: 7, all: 12 },
};

export const ticketStatsResponse = { data: { open: 4, open_high: 1, waiting: 1, resolved_30d: 7, first_response_minutes: 135 } };

export const staffResponse = { data: [{ id: IDS.operator, name: 'Ops Support' }] };

export const validationProblem = {
  type: 'https://api.test/problems/validation_failed',
  title: 'Données invalides',
  status: 422,
  detail: 'Certaines informations sont invalides.',
  code: 'validation_failed',
  errors: { 'attachments.0': ['Le fichier « photo.png » dépasse 10 Mo.'] },
};

export const resolvedProblem = {
  type: 'https://api.test/problems/ticket_resolved',
  title: 'Demande résolue',
  status: 409,
  detail: 'Cette demande est résolue : ouvrez-en une nouvelle.',
  code: 'ticket_resolved',
};
