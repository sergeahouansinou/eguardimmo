export const IDS = {
  org: '0b5f2c1e-6d7a-4c8e-9a41-2f6d8e7c1a10',
  lease: '01935a10-0000-7000-8000-000000000001',
  leaseNotice: '01935a10-0000-7000-8000-000000000002',
  leaseDraft: '01935a10-0000-7000-8000-000000000003',
  leaseArchived: '01935a10-0000-7000-8000-000000000004',
  unit: '01935a20-0000-7000-8000-000000000001',
  annex: '01935a20-0000-7000-8000-000000000002',
  property: '01935a30-0000-7000-8000-000000000001',
  tenant: '01935a40-0000-7000-8000-000000000001',
  coTenant: '01935a40-0000-7000-8000-000000000002',
  guarantor: '01935a40-0000-7000-8000-000000000003',
  rentComponent: '01935a50-0000-7000-8000-000000000001',
  chargesComponent: '01935a50-0000-7000-8000-000000000002',
  depositComponent: '01935a50-0000-7000-8000-000000000003',
  supplementComponent: '01935a50-0000-7000-8000-000000000004',
  rentTerm: '01935a60-0000-7000-8000-000000000001',
  chargesTerm: '01935a60-0000-7000-8000-000000000002',
  depositTerm: '01935a60-0000-7000-8000-000000000003',
  unitLine: '01935a70-0000-7000-8000-000000000001',
  annexLine: '01935a70-0000-7000-8000-000000000002',
  tenantLine: '01935a80-0000-7000-8000-000000000001',
  guarantorLine: '01935a80-0000-7000-8000-000000000002',
};

const eur = (amount: number) => ({ amount, currency: 'EUR' });

export const unit = { id: IDS.unit, reference: 'A12', property: { id: IDS.property, name: 'Résidence du Port' } };
export const tenant = { id: IDS.tenant, display_name: 'Awa Diallo', kind: 'person', is_anonymized: false };
export const guarantor = { id: IDS.guarantor, display_name: 'Marc Chevalier', kind: 'person', is_anonymized: false };

export const rentComponent = { id: IDS.rentComponent, key: 'rent', label: 'Loyer', semantic_key: 'rent' };
export const chargesComponent = { id: IDS.chargesComponent, key: 'charges_provision', label: 'Provision pour charges', semantic_key: 'charges_provision' };
export const depositComponent = { id: IDS.depositComponent, key: 'deposit', label: 'Dépôt de garantie', semantic_key: 'deposit' };

export const rentTerm = {
  id: IDS.rentTerm,
  component: rentComponent,
  amount: eur(85000),
  vat_bp: 0,
  indexed: true,
  valid_from: '2026-01-01',
  end_date: null,
  in_force: true,
  reason: 'initial',
  replaces_id: null,
};
export const chargesTerm = { ...rentTerm, id: IDS.chargesTerm, component: chargesComponent, amount: eur(6000), indexed: false };
export const depositTerm = { ...rentTerm, id: IDS.depositTerm, component: depositComponent, amount: eur(85000), indexed: false };

export const leaseSummary = {
  id: IDS.lease,
  reference: 'BL-2026-0001',
  jurisdiction: 'FR',
  regime_key: 'fr.residential.unfurnished',
  status: 'signed',
  phase: 'running',
  starts_on: '2026-01-01',
  end_date: '2028-12-31' as string | null,
  duration_months: 36 as number | null,
  tacit_renewal: true,
  periodicity: 'monthly',
  currency: 'EUR',
  main_unit: unit,
  tenants: [tenant],
  lock_version: 3,
  archived_at: null as string | null,
};

interface NoticeFixture {
  received_on: string;
  given_by: string;
  departure_on: string | null;
  reason: string | null;
}

const mainUnitLine = { id: IDS.unitLine, unit, is_main: true, valid_from: '2026-01-01', end_date: null };
const annexUnitLine = { id: IDS.annexLine, unit: { ...unit, id: IDS.annex, reference: 'P03' }, is_main: false, valid_from: '2026-01-01', end_date: null };
const tenantLine = { id: IDS.tenantLine, party: tenant, role: 'tenant', joint_liability: false, guarantees_party_id: null, guarantee: null, valid_from: '2026-01-01', end_date: null };
const guarantorLine = {
  id: IDS.guarantorLine,
  party: guarantor,
  role: 'guarantor',
  joint_liability: false,
  guarantees_party_id: IDS.tenant as string | null,
  guarantee: { limit: eur(300000), ends_on: '2029-01-01' } as { limit: { amount: number; currency: string }; ends_on: string | null } | null,
  valid_from: '2026-01-01',
  end_date: null,
};

export const leaseDetail = {
  ...leaseSummary,
  billing_timing: 'advance',
  due_day: 5,
  payment_method: 'transfer',
  signed_on: '2025-12-15' as string | null,
  signed_file_id: null,
  notice: null as NoticeFixture | null,
  jurisdiction_data: { revision_index: 'irl', rent_control: true },
  custom_fields: {},
  note: 'Clés remises',
  units: [mainUnitLine, annexUnitLine],
  parties: [tenantLine, guarantorLine],
  terms: [rentTerm, chargesTerm, depositTerm],
};

export const noticeDetail = {
  ...leaseDetail,
  id: IDS.leaseNotice,
  reference: 'BL-2026-0002',
  phase: 'notice',
  lock_version: 4,
  notice: { received_on: '2026-10-01', given_by: 'tenant', departure_on: '2026-11-30', reason: 'Mutation professionnelle' },
};

export const draftDetail = {
  ...leaseDetail,
  id: IDS.leaseDraft,
  reference: 'BL-2026-0003',
  status: 'draft',
  phase: 'draft',
  lock_version: 1,
  signed_on: null,
  tenants: [tenant],
  units: [mainUnitLine],
  parties: [tenantLine, guarantorLine],
};

export const archivedDetail = { ...leaseDetail, id: IDS.leaseArchived, reference: 'BL-2025-0009', phase: 'ended', archived_at: '2026-06-01T10:00:00+00:00' };

const summaryOf = (detail: typeof leaseDetail) => ({
  id: detail.id,
  reference: detail.reference,
  jurisdiction: detail.jurisdiction,
  regime_key: detail.regime_key,
  status: detail.status,
  phase: detail.phase,
  starts_on: detail.starts_on,
  end_date: detail.end_date,
  duration_months: detail.duration_months,
  tacit_renewal: detail.tacit_renewal,
  periodicity: detail.periodicity,
  currency: detail.currency,
  main_unit: detail.main_unit,
  tenants: detail.tenants,
  lock_version: detail.lock_version,
  archived_at: detail.archived_at,
});

export const pageOf = (items: readonly (typeof leaseDetail)[], nextCursor: string | null = null) => ({
  data: items.map(summaryOf),
  links: { first: null, last: null, prev: null, next: nextCursor === null ? null : `https://api.test/api/v1/org/${IDS.org}/leases?cursor=${nextCursor}` },
  meta: { path: `https://api.test/api/v1/org/${IDS.org}/leases`, per_page: 100, next_cursor: nextCursor, prev_cursor: null },
});

export const detailResponse = (detail: typeof leaseDetail) => ({ data: detail });

export const termsResponse = { data: [rentTerm, { ...rentTerm, id: '01935a60-0000-7000-8000-000000000009', amount: eur(88000), valid_from: '2026-11-16', reason: 'revision', replaces_id: IDS.rentTerm }], meta: { lock_version: 4 } };

const regime = (key: string, label: string, furnished: boolean) => ({
  key,
  label,
  jurisdiction: 'FR',
  currency: 'EUR',
  defaults: {
    duration_months: furnished ? 12 : 36,
    minimum_duration_months: furnished ? 12 : 36,
    maximum_duration_months: null,
    tacit_renewal: true,
    renewal_months: furnished ? 12 : 36,
    deposit_cap_months: furnished ? 2 : 1,
    tenant_notice_months: furnished ? 1 : 3,
    landlord_notice_months: 6,
  },
  jurisdiction_data_fields: [{ key: 'revision_index', type: 'choice', options: ['irl'] }],
});

export const regimesResponse = {
  data: [
    regime('fr.residential.furnished', 'Logement meublé (loi du 6 juillet 1989)', true),
    regime('fr.residential.unfurnished', 'Logement vide (loi du 6 juillet 1989)', false),
  ],
};

export const catalogTermsResponse = {
  data: [
    { id: IDS.rentComponent, vocabulary: 'lease_component', key: 'rent', labels: { fr: 'Loyer' }, semantic_key: 'rent', parent_id: null, position: 1, metadata: {}, platform: true, system: true, archived: false, hidden: false, overridden: false },
    { id: IDS.chargesComponent, vocabulary: 'lease_component', key: 'charges_provision', labels: { fr: 'Provision pour charges' }, semantic_key: 'charges_provision', parent_id: null, position: 2, metadata: {}, platform: true, system: true, archived: false, hidden: false, overridden: false },
    { id: IDS.depositComponent, vocabulary: 'lease_component', key: 'deposit', labels: { fr: 'Dépôt de garantie' }, semantic_key: 'deposit', parent_id: null, position: 3, metadata: {}, platform: true, system: true, archived: false, hidden: false, overridden: false },
    { id: IDS.supplementComponent, vocabulary: 'lease_component', key: 'rent_supplement', labels: { fr: 'Complément de loyer' }, semantic_key: 'rent_supplement', parent_id: null, position: 4, metadata: {}, platform: true, system: true, archived: false, hidden: false, overridden: false },
  ],
};

export const occupancyResponse = {
  data: [
    { unit, vacant: false, since: '2026-01-01', lease: { id: IDS.lease, reference: 'BL-2026-0001', phase: 'running', starts_on: '2026-01-01', end_date: '2028-12-31', tenants: [tenant] } },
    { unit: { ...unit, id: IDS.annex, reference: 'P03' }, vacant: true, since: null, lease: null },
  ],
};

export const problem = (status: number, code: string, title: string, detail: string, extensions: Record<string, unknown> = {}) => ({
  type: `https://api.test/problems/${code}`,
  title,
  status,
  detail,
  code,
  ...extensions,
});

export const staleProblem = problem(409, 'lease_stale_version', 'Bail modifié entre-temps', 'Le bail a été modifié depuis sa lecture : rechargez-le avant de renvoyer vos changements.');
