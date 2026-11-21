export const PRIVACY_IDS = {
  request: '01934f6e-5555-7000-8000-000000000001',
  second: '01934f6e-5555-7000-8000-000000000002',
  account: '01934f6e-6666-7000-8000-000000000001',
  operator: '01934f6e-ffff-7000-8000-000000000001',
};

export const requestData = (overrides: Record<string, unknown> = {}) => ({
  id: PRIVACY_IDS.request,
  kind: 'access',
  channel: 'account',
  status: 'received',
  received_at: '2026-11-10T09:00:00+00:00',
  due_at: '2026-12-10T09:00:00+00:00',
  extended_until: null,
  extension_reason: null,
  deadline: '2026-12-10T09:00:00+00:00',
  overdue: false,
  identity_verified_by: null,
  identity_verified_at: null,
  requester: { account_id: PRIVACY_IDS.account, name: 'Léa Fontaine', email: 'lea.fontaine@exemple.fr' },
  forwards: { total: 0, handled: 0 },
  refusal_reason: null,
  completed_at: null,
  export: { generated: false, expires_at: null, downloaded: false },
  ...overrides,
});

export const detailData = (overrides: Record<string, unknown> = {}) =>
  requestData({
    events: [
      { kind: 'received', occurred_at: '2026-11-10T09:00:00+00:00', actor_id: PRIVACY_IDS.account },
      { kind: 'verified', occurred_at: '2026-11-11T09:00:00+00:00', actor_id: PRIVACY_IDS.operator },
    ],
    ...overrides,
  });

export const erasureData = (overrides: Record<string, unknown> = {}) =>
  detailData({ id: PRIVACY_IDS.second, kind: 'erasure', status: 'in_progress', identity_verified_by: 'video_call', identity_verified_at: '2026-11-11T09:00:00+00:00', ...overrides });

export const overdueData = () => requestData({ id: PRIVACY_IDS.second, kind: 'rectification', channel: 'letter', overdue: true, due_at: '2026-11-01T09:00:00+00:00', deadline: '2026-11-01T09:00:00+00:00', forwards: { total: 3, handled: 1 }, export: { generated: true, expires_at: '2026-12-10T09:00:00+00:00', downloaded: false } });

export const listResponse = (rows: Record<string, unknown>[] = [requestData(), overdueData()], meta: Record<string, unknown> = {}) => ({
  data: rows,
  meta: { has_more: false, next_cursor: null, open_count: rows.length, overdue_count: rows.filter((row) => row.overdue === true).length, ...meta },
});

export const detailResponse = (overrides: Record<string, unknown> = {}) => ({ data: detailData(overrides) });
