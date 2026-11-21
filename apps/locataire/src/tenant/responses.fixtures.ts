export const ORG_PORT = { id: '0193a5e0-7b1c-7a3e-8c2d-1f2e3d4c5b6a', name: 'Agence du Port' };
export const ORG_LOIRE = { id: '0193a5e0-7b1c-7a3e-8c2d-2a3b4c5d6e7f', name: 'Immo Loire' };

export const LEASE_ID = '0193a5e1-0000-7000-8000-000000000001';
export const LEASE_LOIRE_ID = '0193a5e1-0000-7000-8000-000000000002';
export const LEASE_ENDED_ID = '0193a5e1-0000-7000-8000-000000000003';
export const PARTY_PORT_ID = '0193a5e2-0000-7000-8000-00000000000a';
export const PARTY_LOIRE_ID = '0193a5e2-0000-7000-8000-00000000000b';

export const unit = {
  reference: 'A12',
  type: 'apartment',
  floor: 2,
  surface_hundredths: 4250,
  property: {
    name: 'Résidence du Port',
    address: { line1: '12 quai du Port', line2: null, postal_code: '44000', city: 'Nantes', country: 'FR' },
  },
};

export function summary(overrides: Record<string, unknown> = {}) {
  return {
    id: LEASE_ID,
    reference: 'BAIL-2026-001',
    regime_key: 'fr.residential.unfurnished',
    status: 'signed',
    phase: 'running',
    starts_on: '2026-01-01',
    end_date: '2028-12-31',
    organization: ORG_PORT,
    main_unit: unit,
    access: { until: '2029-12-31', in_grace: false },
    ...overrides,
  };
}

export function leasePage(items: unknown[], nextCursor: string | null = null) {
  return {
    data: items,
    links: { first: null, last: null, prev: null, next: nextCursor === null ? null : `http://localhost/api/v1/tenant/leases?cursor=${nextCursor}` },
    meta: { path: 'http://localhost/api/v1/tenant/leases', per_page: 25, next_cursor: nextCursor, prev_cursor: null },
  };
}

export function detail(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      ...summary(),
      duration_months: 36,
      tacit_renewal: true,
      periodicity: 'monthly',
      billing_timing: 'advance',
      due_day: 5,
      currency: 'EUR',
      payment_method: 'transfer',
      signed_on: '2025-12-15',
      notice: null,
      units: [{ unit, is_main: true, valid_from: '2026-01-01', end_date: null }],
      parties: [
        { display_name: 'Awa Koné', role: 'tenant', is_me: true, joint_liability: true, valid_from: '2026-01-01', end_date: null },
        { display_name: 'Moussa Diallo', role: 'tenant', is_me: false, joint_liability: true, valid_from: '2026-01-01', end_date: null },
        { display_name: 'Fatou Sow', role: 'guarantor', is_me: false, joint_liability: false, valid_from: '2026-01-01', end_date: null },
      ],
      terms_on: '2026-11-16',
      terms: [
        {
          component: { key: 'rent', label: 'Loyer', semantic_key: 'rent' },
          amount: { amount: 65000, currency: 'EUR' },
          vat_bp: 0,
          indexed: true,
          valid_from: '2026-01-01',
          end_date: null,
        },
        {
          component: { key: 'charges_provision', label: 'Provision sur charges', semantic_key: 'charges_provision' },
          amount: { amount: 8000, currency: 'EUR' },
          vat_bp: 0,
          indexed: false,
          valid_from: '2026-01-01',
          end_date: null,
        },
      ],
      ...overrides,
    },
  };
}

export function links(items: { id: string; organization: { id: string; name: string | null } }[]) {
  return { data: items };
}

export const ME = { data: { id: '0193a5e3-0000-7000-8000-000000000001', name: 'Awa Koné', email: 'awa.kone@example.test', email_verified_at: '2026-01-02T08:00:00+00:00', last_login_at: null, previous_login_at: null } };

export const TENANT_PROFILES = { data: [{ space: 'tenant', label: 'Locataire', meta: { links: 1 } }] };
export const NO_PROFILES = { data: [{ space: 'organization', label: 'Agence du Port', meta: { organization: ORG_PORT.id, kind: 'agency', role: 'owner' } }] };

export function problem(status: number, code: string, detail: string) {
  return { type: `https://eguardimmo.test/problems/${code}`, title: detail, status, code, detail };
}
