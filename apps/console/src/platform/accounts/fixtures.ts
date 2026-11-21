import { IDS } from '../fixtures';

export const accountSummary = (overrides: Record<string, unknown> = {}) => ({
  id: IDS.user,
  name: 'Jeanne Martin',
  email: 'jeanne@exemple.fr',
  deleted: false,
  suspended: false,
  is_operator: false,
  ...overrides,
});

export const accountFile = (overrides: Record<string, unknown> = {}) => ({
  id: IDS.user,
  name: 'Jeanne Martin',
  email: 'jeanne@exemple.fr',
  created_at: '2026-03-04T10:00:00+00:00',
  email_verified: true,
  last_login_at: '2026-11-20T07:45:00+00:00',
  deleted: false,
  deleted_at: null,
  is_operator: false,
  suspension: null,
  two_factor: { enabled: true, recovery_codes_remaining: 2 },
  devices_count: 1,
  tokens_count: 1,
  profile_types: ['organization', 'tenant'],
  organizations_count: 2,
  ...overrides,
});

export const suspensionState = (overrides: Record<string, unknown> = {}) => ({
  suspended_at: '2026-11-20T11:00:00+00:00',
  reason: 'fraud',
  reviewed: false,
  reviewed_at: null,
  ...overrides,
});
