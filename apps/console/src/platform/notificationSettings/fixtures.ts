export const notificationType = (overrides: Record<string, unknown> = {}) => ({
  type: 'rent.overdue',
  label: 'Loyer en retard',
  group: 'Finances',
  audience: 'staff',
  audience_label: 'Équipes',
  channels: [
    { channel: 'in_app', label: 'Application', enabled: true, locked: false, default: true },
    { channel: 'email', label: 'E-mail', enabled: true, locked: false, default: true },
    { channel: 'push', label: 'Mobile', enabled: false, locked: false, default: false },
  ],
  ...overrides,
});

export const lockedNotificationType = () =>
  notificationType({
    type: 'tenant.payment_cancelled',
    label: 'Paiement annulé',
    group: 'Loyers',
    audience: 'tenant',
    audience_label: 'Locataires',
    channels: [
      { channel: 'in_app', label: 'Application', enabled: true, locked: true, default: true },
      { channel: 'email', label: 'E-mail', enabled: true, locked: false, default: true },
    ],
  });

export const reminder = (overrides: Record<string, unknown> = {}) => ({
  code: 'account_inactive',
  label: 'Compte inactif',
  description: 'Aucune activité sur le compte.',
  category: 'account',
  category_label: 'Comptes',
  timing: 'after',
  enabled: false,
  delay_days: 14,
  delay_min: 7,
  delay_max: 365,
  repeat_every_days: 30,
  max_occurrences: 2,
  occurrences_limit: 5,
  channels: ['email', 'push'],
  available_channels: ['in_app', 'email', 'push'],
  last_run_at: null,
  last_sent_count: null,
  updated_at: null,
  ...overrides,
});

export const rentDueReminder = (overrides: Record<string, unknown> = {}) =>
  reminder({
    code: 'rent_due_soon',
    label: 'Échéance à venir',
    description: 'Échéance non soldée à venir.',
    category: 'tenant',
    category_label: 'Locataires',
    timing: 'before',
    enabled: true,
    delay_days: 3,
    delay_min: 1,
    delay_max: 15,
    repeat_every_days: null,
    max_occurrences: 1,
    channels: ['email'],
    last_run_at: '2026-11-24T08:00:00+00:00',
    last_sent_count: 12,
    updated_at: '2026-11-20T10:00:00+00:00',
    ...overrides,
  });
