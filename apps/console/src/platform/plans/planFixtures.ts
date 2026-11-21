export const PLAN_IDS = {
  gold: '01934f6e-1111-7000-8000-000000000001',
  silver: '01934f6e-1111-7000-8000-000000000002',
  v1: '01934f6e-2222-7000-8000-000000000001',
  v2: '01934f6e-2222-7000-8000-000000000002',
  v3: '01934f6e-2222-7000-8000-000000000003',
  org: '01934f6e-3333-7000-8000-000000000001',
  subscription: '01934f6e-4444-7000-8000-000000000001',
  subscriptionTwo: '01934f6e-4444-7000-8000-000000000002',
};

const entitlement = (feature: string, label: string, group: string, kind: 'quota' | 'function', enabled: boolean, limit: number | null) => ({ feature, label, group, kind, enabled, limit });

export const entitlements = () => [
  entitlement('leases', 'Baux', 'socle', 'quota', true, 200),
  entitlement('mandates', 'Mandats', 'gestion', 'function', true, null),
  entitlement('properties', 'Lots', 'socle', 'quota', true, null),
  entitlement('rent', 'Loyers', 'socle', 'function', true, null),
  entitlement('reporting', 'Comptes rendus', 'pilotage', 'function', false, null),
  entitlement('storage_mb', 'Stockage (Mo)', 'socle', 'quota', true, 5000),
];

export const prices = () => [
  { currency: 'CAD', monthly_amount: 4900, yearly_amount: 49000 },
  { currency: 'EUR', monthly_amount: 3500, yearly_amount: 35000 },
];

export const versionData = (overrides: Record<string, unknown> = {}) => ({
  id: PLAN_IDS.v1,
  version: 1,
  status: 'published',
  trial_days: 15,
  public_signup: true,
  published_at: '2026-10-01T08:00:00+00:00',
  archived_at: null,
  prices: prices(),
  entitlements: entitlements(),
  ...overrides,
});

export const archivedVersion = () => versionData({ id: PLAN_IDS.v1, version: 1, status: 'archived', archived_at: '2026-11-01T08:00:00+00:00' });
export const publishedVersion = () => versionData({ id: PLAN_IDS.v2, version: 2 });
export const draftVersion = () =>
  versionData({ id: PLAN_IDS.v3, version: 3, status: 'draft', published_at: null, public_signup: false, prices: [{ currency: 'EUR', monthly_amount: 3900, yearly_amount: 39000 }] });

export const planData = (overrides: Record<string, unknown> = {}) => ({
  id: PLAN_IDS.gold,
  code: 'gold',
  name: 'Gold',
  versions: [draftVersion(), publishedVersion(), archivedVersion()],
  ...overrides,
});

export const silverPlan = () =>
  planData({ id: PLAN_IDS.silver, code: 'silver', name: 'Silver', versions: [versionData({ id: PLAN_IDS.v2, version: 1, entitlements: [entitlement('rent', 'Loyers', 'socle', 'function', true, null)] })] });

export const plansResponse = () => ({ data: [planData(), silverPlan()] });
export const planResponse = (plan: Record<string, unknown> = planData()) => ({ data: plan });
export const versionResponse = (version: Record<string, unknown> = draftVersion()) => ({ data: version });

export const subscriptionData = (overrides: Record<string, unknown> = {}) => ({
  id: PLAN_IDS.subscription,
  organization_id: PLAN_IDS.org,
  plan: 'gold',
  plan_version: 2,
  status: 'trialing',
  currency: 'EUR',
  trial_ends_at: '2026-11-23T10:00:00+00:00',
  current_period_end: null,
  created_at: '2026-11-08T10:00:00+00:00',
  ...overrides,
});

export const subscriptionsResponse = (rows: Record<string, unknown>[] = [subscriptionData(), subscriptionData({ id: PLAN_IDS.subscriptionTwo, status: 'active', trial_ends_at: null, current_period_end: '2026-12-08T10:00:00+00:00', currency: null })], meta: Record<string, unknown> = {}) => ({
  data: rows,
  meta: { has_more: false, next_cursor: null, mrr: null, arr: null, ...meta },
});
