import { IDS } from '../fixtures';

export const organisationRow = (overrides: Record<string, unknown> = {}) => ({
  id: IDS.org,
  name: 'Agence du Port',
  kind: 'agency',
  country: 'FR',
  created_at: '2026-09-02T08:15:00+00:00',
  state: 'active',
  suspension: null,
  members_count: 3,
  plan: 'silver',
  subscription_status: 'active',
  ...overrides,
});

export const organisationDetail = (overrides: Record<string, unknown> = {}) => ({
  ...organisationRow(),
  two_factor_required: false,
  owner: { first_name: 'Awa', last_name: 'Diallo', account_id: IDS.user },
  ...overrides,
});

export const suspendedSuspension = { suspended_at: '2026-11-18T09:00:00+00:00', reason: 'fraud' };

export const organisationList = (rows: Record<string, unknown>[], meta: Record<string, unknown> = {}) => ({
  data: rows,
  meta: { has_more: false, next_cursor: null, ...meta },
});

export const supportAccess = (overrides: Record<string, unknown> = {}) => ({
  id: '01934f6e-1111-7000-8000-000000000001',
  kind: 'consent',
  status: 'active',
  scopes: ['settings', 'team'],
  reason: 'Aide à la configuration des accès',
  duration_hours: 24,
  operator: { id: IDS.second, name: 'Jean Moreau' },
  requested_at: '2026-11-20T09:00:00+00:00',
  granted_at: '2026-11-20T09:30:00+00:00',
  expires_at: '2026-11-21T09:30:00+00:00',
  revoked_at: null,
  reviewed: false,
  read_count: 2,
  ...overrides,
});

export const entitlementsView = (overrides: Record<string, unknown> = {}) => ({
  data: {
    organization_id: IDS.org,
    subscription: { plan: 'silver', plan_version: 2, status: 'active', trial_ends_at: null, currency: 'EUR' },
    entitlements: [
      { feature: 'properties', label: 'Lots', group: 'socle', kind: 'quota', enabled: true, limit: 50, source: 'plan' },
      { feature: 'users', label: 'Utilisateurs', group: 'socle', kind: 'quota', enabled: true, limit: 10, source: 'override' },
      { feature: 'banking', label: 'Rapprochement bancaire', group: 'gestion', kind: 'function', enabled: false, limit: null, source: 'plan' },
    ],
    overrides: [
      {
        id: '01934f6e-2222-7000-8000-000000000001',
        feature: 'users',
        enabled: true,
        limit: 10,
        starts_at: '2026-11-19T10:00:00+00:00',
        ends_at: '2027-02-19T10:00:00+00:00',
        reason_code: 'commercial_gesture',
        revoked_at: null,
      },
    ],
    ...overrides,
  },
});
