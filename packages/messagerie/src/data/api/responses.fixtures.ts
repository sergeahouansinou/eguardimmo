const ORG = '0b5f2c1e-6d7a-4c8e-9a41-2f6d8e7c1a10';
export const IDS = {
  org: ORG,
  me: '5d1c9a3e-1b2f-4f60-8a77-3c4d5e6f7a81',
  colleague: '8e2a4b6c-9d1f-4a3b-b5c7-0d1e2f3a4b52',
  conversation: 'c4d6e8f0-2a4c-4e6a-8c0e-1a3c5e7a9b24',
  attachment: 'a1b2c3d4-0000-4000-8000-00000000a001',
};

const piece = { id: IDS.attachment, name: 'quittance.pdf', mime_type: 'application/pdf', size_bytes: 20480 };

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

export const validationProblem = {
  type: 'https://api.test/problems/validation_failed',
  title: 'Données invalides',
  status: 422,
  detail: 'Certaines informations sont invalides.',
  code: 'validation_failed',
  errors: { 'attachments.0': ['Le fichier « photo.png » dépasse 10 Mo.'] },
};
