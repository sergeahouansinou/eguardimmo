// Réponses réelles du module Notifications (tests/Feature/Notifications), relevées par un test jetable sur SQLite en mémoire.

export const ORGANIZATION_ID = '01a1ee5a-0b9c-728d-8775-faf0fdebd2c4';

export const listPage1 = {
  data: [
    {
      id: '01a1ee5a-0bb8-7196-a51f-858c4da21ebb',
      type: 'rent.payment_cancelled',
      tone: 'warning',
      title: 'Paiement annulé',
      detail: 'Un paiement du bail BL-2026-001 a été annulé : les échéances concernées sont recalculées.',
      unread: true,
      href: '/finances/encaissements',
      organization_id: '01a1ee5a-0b9c-728d-8775-faf0fdebd2c4',
      created_at: '2026-11-16T10:00:00+00:00',
      read_at: null,
    },
    {
      id: '01a1ee5a-0bb7-73fa-a273-ea6cbe237da4',
      type: 'compliance.certificate_expired',
      tone: 'danger',
      title: 'Pièce expirée',
      detail: 'Le DPE a expiré le 01/11/2026.',
      unread: false,
      href: '/conformite/01935a60-0000-7000-8000-000000000001',
      organization_id: '01a1ee5a-0b9c-728d-8775-faf0fdebd2c4',
      created_at: '2026-11-16T10:00:00+00:00',
      read_at: '2026-11-16T10:00:00+00:00',
    },
  ],
  links: {
    first: null,
    last: null,
    prev: null,
    next: 'https://api.eguardimmo.test/api/v1/notifications?cursor=eyJpZCI6IjAxYTFlZTVhLTBiYjctNzNmYS1hMjczLWVhNmNiZTIzN2RhNCIsIl9wb2ludHNUb05leHRJdGVtcyI6dHJ1ZX0',
  },
  meta: {
    path: 'https://api.eguardimmo.test/api/v1/notifications',
    per_page: 2,
    next_cursor: 'eyJpZCI6IjAxYTFlZTVhLTBiYjctNzNmYS1hMjczLWVhNmNiZTIzN2RhNCIsIl9wb2ludHNUb05leHRJdGVtcyI6dHJ1ZX0',
    prev_cursor: null,
  },
};

export const listPage2 = {
  data: [
    {
      id: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa643',
      type: 'rent.overdue',
      tone: 'danger',
      title: 'Loyer en retard',
      detail: 'L\'échéance du 05/11/2026 du bail BL-2026-001 n\'est pas soldée.',
      unread: true,
      href: '/finances/impayes',
      organization_id: '01a1ee5a-0b9c-728d-8775-faf0fdebd2c4',
      created_at: '2026-11-16T10:00:00+00:00',
      read_at: null,
    },
  ],
  links: {
    first: null,
    last: null,
    prev: 'https://api.eguardimmo.test/api/v1/notifications?cursor=eyJpZCI6IjAxYTFlZTVhLTBiYjctNzNmYS1hMjczLWVhNmNiZDlhYTY0MyIsIl9wb2ludHNUb05leHRJdGVtcyI6ZmFsc2V9',
    next: null,
  },
  meta: {
    path: 'https://api.eguardimmo.test/api/v1/notifications',
    per_page: 2,
    next_cursor: null,
    prev_cursor: 'eyJpZCI6IjAxYTFlZTVhLTBiYjctNzNmYS1hMjczLWVhNmNiZDlhYTY0MyIsIl9wb2ludHNUb05leHRJdGVtcyI6ZmFsc2V9',
  },
};

export const listUnread = {
  data: [
    {
      id: '01a1ee5a-0bb8-7196-a51f-858c4da21ebb',
      type: 'rent.payment_cancelled',
      tone: 'warning',
      title: 'Paiement annulé',
      detail: 'Un paiement du bail BL-2026-001 a été annulé : les échéances concernées sont recalculées.',
      unread: true,
      href: '/finances/encaissements',
      organization_id: '01a1ee5a-0b9c-728d-8775-faf0fdebd2c4',
      created_at: '2026-11-16T10:00:00+00:00',
      read_at: null,
    },
    {
      id: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa643',
      type: 'rent.overdue',
      tone: 'danger',
      title: 'Loyer en retard',
      detail: 'L\'échéance du 05/11/2026 du bail BL-2026-001 n\'est pas soldée.',
      unread: true,
      href: '/finances/impayes',
      organization_id: '01a1ee5a-0b9c-728d-8775-faf0fdebd2c4',
      created_at: '2026-11-16T10:00:00+00:00',
      read_at: null,
    },
  ],
  links: {
    first: null,
    last: null,
    prev: null,
    next: null,
  },
  meta: {
    path: 'https://api.eguardimmo.test/api/v1/notifications',
    per_page: 25,
    next_cursor: null,
    prev_cursor: null,
  },
};

export const listTenant = {
  data: [
    {
      id: '01a1ee5a-0bb8-7196-a51f-858c4ee79b3d',
      type: 'tenant.receipt_issued',
      tone: 'success',
      title: 'Quittance émise',
      detail: 'Votre quittance est disponible.',
      unread: true,
      href: '/loyers',
      organization_id: '01a1ee5a-0b9c-728d-8775-faf0fdebd2c4',
      created_at: '2026-11-16T10:00:00+00:00',
      read_at: null,
    },
  ],
  links: {
    first: null,
    last: null,
    prev: null,
    next: null,
  },
  meta: {
    path: 'https://api.eguardimmo.test/api/v1/notifications',
    per_page: 25,
    next_cursor: null,
    prev_cursor: null,
  },
};

export const unreadCount = {
  data: {
    unread: 2,
  },
};

export const readOne = {
  data: {
    id: '01a1ee5a-0bb7-73fa-a273-ea6cbd9aa643',
    type: 'rent.overdue',
    tone: 'danger',
    title: 'Loyer en retard',
    detail: 'L\'échéance du 05/11/2026 du bail BL-2026-001 n\'est pas soldée.',
    unread: false,
    href: '/finances/impayes',
    organization_id: '01a1ee5a-0b9c-728d-8775-faf0fdebd2c4',
    created_at: '2026-11-16T10:00:00+00:00',
    read_at: '2026-11-16T10:00:00+00:00',
  },
};

export const readAll = {
  data: {
    updated: 1,
  },
};

export const mandatoryChannelProblem = {
  type: 'https://api.eguardimmo.test/problems/notification_channel_mandatory',
  title: 'Canal obligatoire',
  status: 422,
  detail: 'Ce canal ne peut pas être désactivé pour ce type de notification.',
  code: 'notification_channel_mandatory',
  request_id: '01a1ee5a-0be9-7158-acc5-1ed0aa70d98f',
};

export const validationProblem = {
  type: 'https://api.eguardimmo.test/problems/validation_failed',
  title: 'Données invalides',
  status: 422,
  detail: 'Certaines informations sont invalides.',
  code: 'validation_failed',
  errors: {
    preferences: [
      'Le champ preferences est obligatoire.',
    ],
  },
  request_id: '01a1ee5a-0beb-7325-9478-347e9d03afb5',
};

export const notificationNotFoundProblem = {
  type: 'https://api.eguardimmo.test/problems/notification_not_found',
  title: 'Notification introuvable',
  status: 404,
  detail: 'Cette notification n\'existe pas ou ne vous concerne pas.',
  code: 'notification_not_found',
  request_id: '01a1ee5a-0bee-72fa-b870-9e1d8a12fecd',
};

export const unauthenticatedProblem = {
  type: 'https://api.eguardimmo.test/problems/unauthenticated',
  title: 'Non authentifié',
  status: 401,
  detail: 'Connectez-vous pour continuer.',
  code: 'unauthenticated',
  request_id: '01a1ee5a-0bf4-7114-af87-8622eb06b355',
};
