export const IDS = {
  org: '01934f6e-0000-7000-8000-00000000000b',
  lease: '01934f6e-0000-7000-8000-000000000131',
  leaseB: '01934f6e-0000-7000-8000-000000000132',
  partyAwa: '01934f6e-0000-7000-8000-000000000201',
  partyMarc: '01934f6e-0000-7000-8000-000000000202',
  linkAwa: '01934f6e-0000-7000-8000-000000000211',
  linkMarc: '01934f6e-0000-7000-8000-000000000212',
  unit: '01934f6e-0000-7000-8000-0000000000b1',
  property: '01934f6e-0000-7000-8000-0000000000a1',
  user: '01934f6e-0000-7000-8000-000000000301',
} as const;

export const party = (id: string, displayName: string) => ({ id, display_name: displayName, kind: 'person', is_anonymized: false });

export const unit = { id: IDS.unit, reference: 'A12', property: { id: IDS.property, name: 'Résidence des Lilas' } };

export const leaseSummary = {
  id: IDS.lease,
  reference: 'BL-2026-0042',
  jurisdiction: 'fr',
  regime_key: 'fr_residential_unfurnished',
  status: 'signed',
  phase: 'running',
  starts_on: '2026-01-01',
  end_date: null,
  duration_months: 36,
  tacit_renewal: true,
  periodicity: 'monthly',
  currency: 'EUR',
  main_unit: unit,
  tenants: [party(IDS.partyAwa, 'Awa Diallo'), party(IDS.partyMarc, 'Marc Chevalier')],
  lock_version: 4,
  archived_at: null,
};

export const leaseDetail = {
  ...leaseSummary,
  billing_timing: 'in_advance',
  due_day: 5,
  payment_method: 'transfer',
  signed_on: '2025-12-20',
  signed_file_id: null,
  notice: null,
  jurisdiction_data: {},
  custom_fields: {},
  note: null,
  units: [{ id: '01934f6e-0000-7000-8000-000000000221', unit, is_main: true, valid_from: '2026-01-01', end_date: null }],
  parties: [
    { id: IDS.linkAwa, party: party(IDS.partyAwa, 'Awa Diallo'), role: 'tenant', joint_liability: true, guarantees_party_id: null, guarantee: null, valid_from: '2026-01-01', end_date: null },
    { id: IDS.linkMarc, party: party(IDS.partyMarc, 'Marc Chevalier'), role: 'tenant', joint_liability: true, guarantees_party_id: null, guarantee: null, valid_from: '2026-01-01', end_date: null },
  ],
  terms: [],
};

export const leaseResponse = { data: leaseDetail };

export const cursorPage = (items: readonly unknown[], next: string | null = null) => ({
  data: items,
  links: { first: null, last: null, prev: null, next: null },
  meta: { path: 'https://api.test/x', per_page: 25, next_cursor: next, prev_cursor: null },
});
