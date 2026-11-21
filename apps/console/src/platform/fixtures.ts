export const IDS = {
  me: '01934f6e-ffff-7000-8000-000000000001',
  second: '01934f6e-ffff-7000-8000-000000000002',
  org: '01934f6e-cccc-7000-8000-000000000001',
  user: '01934f6e-eeee-7000-8000-000000000001',
  approval: '01934f6e-aaaa-7000-8000-000000000001',
  version: '01934f6e-bbbb-7000-8000-000000000001',
  request: '01934f6e-dddd-7000-8000-000000000001',
};

export const problem = (status: number, code: string, detail: string, title = 'Erreur') => ({ type: `/problems/${code}`, title, status, code, detail });

export const proofRequired = problem(422, 'operator_proof_required', 'Saisissez un code de double authentification pour confirmer cette opération.', 'Code de double authentification requis');
export const proofInvalid = problem(422, 'operator_proof_invalid', 'Ce code de double authentification est incorrect ou a déjà été utilisé.', 'Code de double authentification invalide');
export const roleRequired = problem(403, 'operator_role_required', 'Votre rôle d’opérateur ne permet pas cette opération.', 'Rôle opérateur requis');

export const meData = (roles: string[] = ['admin']) => ({
  data: {
    id: IDS.me,
    name: 'Awa Diallo',
    email: 'awa.diallo@eguardimmo.test',
    email_verified_at: '2026-11-01T09:00:00+00:00',
    phone: null,
    last_login_at: '2026-11-16T08:30:00+00:00',
    previous_login_at: null,
    roles,
  },
});

export const approvalData = (overrides: Record<string, unknown> = {}) => ({
  id: IDS.approval,
  action: 'organizations.suspend',
  subject: { type: 'organization', id: IDS.org },
  organization_id: IDS.org,
  status: 'pending',
  reason: 'Soupçon de fraude documentaire signalé par le support.',
  ticket_reference: 'SUP-2026-00042',
  payload: { reason_code: 'fraud' },
  requested_by: { id: IDS.second, name: 'Jean Moreau' },
  requested_proof: 'totp',
  decided_by: null,
  decided_proof: null,
  decided_at: null,
  executed_at: null,
  failure_code: null,
  expires_at: '2026-11-22T10:00:00+00:00',
  created_at: '2026-11-21T10:00:00+00:00',
  lock_version: 0,
  permissions: { can_decide: true, can_cancel: false },
  ...overrides,
});

export const approvalList = (rows: Record<string, unknown>[], meta: Record<string, unknown> = {}) => ({
  data: rows,
  meta: { has_more: false, next_cursor: null, pending_count: rows.filter((row) => row.status === 'pending').length, ...meta },
});
