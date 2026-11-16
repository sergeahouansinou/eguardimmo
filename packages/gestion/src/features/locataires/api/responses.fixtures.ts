export const IDS = {
  org: '0b5f2c1e-6d7a-4c8e-9a41-2f6d8e7c1a10',
  awa: '01935b10-0000-7000-8000-000000000001',
  societe: '01935b10-0000-7000-8000-000000000002',
  marc: '01935b10-0000-7000-8000-000000000003',
  nina: '01935b10-0000-7000-8000-000000000004',
  garant: '01935b10-0000-7000-8000-000000000005',
  lea: '01935b10-0000-7000-8000-000000000006',
  contactCategory: '01935b50-0000-7000-8000-000000000001',
  emailPoint: '01935b20-0000-7000-8000-000000000001',
  phonePoint: '01935b20-0000-7000-8000-000000000002',
  passport: '01935b30-0000-7000-8000-000000000001',
  bank: '01935b40-0000-7000-8000-000000000001',
  unit: '01935a20-0000-7000-8000-000000000001',
  annex: '01935a20-0000-7000-8000-000000000002',
  property: '01935a30-0000-7000-8000-000000000001',
  lease: '01935a10-0000-7000-8000-000000000001',
  leaseOld: '01935a10-0000-7000-8000-000000000002',
  leaseGuarantee: '01935a10-0000-7000-8000-000000000003',
  leaseLine: '01935a80-0000-7000-8000-000000000001',
  guarantorLine: '01935a80-0000-7000-8000-000000000002',
};

const eur = (amount: number) => ({ amount, currency: 'EUR' });

export const summary = (id: string, displayName: string, overrides: Record<string, unknown> = {}) => ({
  id,
  kind: 'person',
  display_name: displayName,
  primary_email: null,
  primary_phone: null,
  is_anonymized: false,
  archived_at: null,
  ...overrides,
});

export const awaSummary = summary(IDS.awa, 'Awa Diallo', { primary_email: 'awa.diallo@example.com', primary_phone: '+33 6 00 00 00 01' });
export const societeSummary = summary(IDS.societe, 'Ramonage du Port SARL', { kind: 'company', primary_email: 'contact@ramonage.example.com' });
export const marcSummary = summary(IDS.marc, 'Marc Chevalier');
export const ninaSummary = summary(IDS.nina, 'Nina Archive', { archived_at: '2026-10-01T09:30:00+00:00' });
export const garantSummary = summary(IDS.garant, 'Paul Garant');
export const leaSummary = summary(IDS.lea, 'Léa Sans Bail');

export const contactCategoriesResponse = { data: [{ id: IDS.contactCategory, vocabulary: 'contact_category', key: 'craftsman', labels: { fr: 'Artisan' }, semantic_key: 'craftsman', archived: false, hidden: false }] };
export const organizationResponse = { data: { id: IDS.org, kind: 'individual', name: 'Awa Diallo', country: 'BJ', two_factor_required: false } };

export const pageOf = (items: readonly Record<string, unknown>[], nextCursor: string | null = null) => ({
  data: items,
  links: { first: null, last: null, prev: null, next: nextCursor === null ? null : `https://api.test/api/v1/org/${IDS.org}/parties?cursor=${nextCursor}` },
  meta: { path: `https://api.test/api/v1/org/${IDS.org}/parties`, per_page: 100, next_cursor: nextCursor, prev_cursor: null },
});

export const emailPoint = { id: IDS.emailPoint, type: 'email', value: 'awa.diallo@example.com', label: null, is_primary: true };
export const phonePoint = { id: IDS.phonePoint, type: 'phone', value: '+33 6 00 00 00 01', label: 'Mobile', is_primary: true };
export const passport = { id: IDS.passport, scheme: 'passport', country: 'FR', value: null, last4: '4567' };
export const bankAccount = { id: IDS.bank, iban_last4: '0189', bic: 'AGRIFRPP', holder_name: 'Awa Diallo', valid_from: '2026-01-01', valid_to: null, is_active: true };

export const awaDetail = {
  id: IDS.awa,
  kind: 'person',
  display_name: 'Awa Diallo',
  last_name: 'Diallo',
  first_name: 'Awa',
  company_name: null,
  legal_form_term_id: null,
  birth_date: '1990-05-12',
  address: { line1: '12 rue du Port', line2: null, postal_code: '13002', city: 'Marseille', country: 'FR' },
  language: 'fr',
  has_account: false,
  custom_fields: {},
  lock_version: 3,
  is_anonymized: false,
  anonymized_at: null,
  archived_at: null,
  categories: [],
  tags: [{ id: '01935b50-0000-7000-8000-000000000001', name: 'Prioritaire', slug: 'prioritaire', color: null }],
  contact_points: [emailPoint, phonePoint],
  identifiers: [passport],
  bank_accounts: [bankAccount],
};

export const societeDetail = {
  ...awaDetail,
  id: IDS.societe,
  kind: 'company',
  display_name: 'Ramonage du Port SARL',
  last_name: null,
  first_name: null,
  company_name: 'Ramonage du Port SARL',
  birth_date: null,
  address: null,
  contact_points: [],
  identifiers: [],
  bank_accounts: [],
  lock_version: 1,
};

export const detailResponse = (detail: Record<string, unknown>) => ({ data: detail });

const unit = { id: IDS.unit, reference: 'A12', property: { id: IDS.property, name: 'Résidence du Port' } };

export const line = (overrides: Record<string, unknown> = {}) => ({
  id: IDS.lease,
  reference: 'BL-2026-0001',
  role: 'tenant',
  phase: 'running',
  main_unit: unit,
  since: '2026-01-01',
  end_date: null,
  ...overrides,
});

export const tenancyEntry = (party: Record<string, unknown>, leases: readonly Record<string, unknown>[]) => ({
  party: { id: party.id, display_name: party.display_name, kind: party.kind, is_anonymized: false },
  leases,
});
export const tenanciesResponse = (entries: readonly Record<string, unknown>[]) => ({ data: entries });

export const leaseDetail = {
  id: IDS.lease,
  reference: 'BL-2026-0001',
  jurisdiction: 'FR',
  regime_key: 'fr.residential.unfurnished',
  status: 'signed',
  phase: 'running',
  starts_on: '2026-01-01',
  end_date: '2028-12-31',
  duration_months: 36,
  tacit_renewal: true,
  periodicity: 'monthly',
  currency: 'EUR',
  main_unit: unit,
  tenants: [{ id: IDS.awa, display_name: 'Awa Diallo', kind: 'person', is_anonymized: false }],
  lock_version: 2,
  archived_at: null,
  terms: [
    { id: '01935a60-0000-7000-8000-000000000001', component: { id: '01935a50-0000-7000-8000-000000000001', key: 'rent', label: 'Loyer', semantic_key: 'rent' }, amount: eur(85000), vat_bp: 0, indexed: true, valid_from: '2026-01-01', end_date: null, in_force: true, reason: 'initial', replaces_id: null },
    { id: '01935a60-0000-7000-8000-000000000002', component: { id: '01935a50-0000-7000-8000-000000000002', key: 'charges_provision', label: 'Provision pour charges', semantic_key: 'charges_provision' }, amount: eur(6000), vat_bp: 0, indexed: false, valid_from: '2026-01-01', end_date: null, in_force: true, reason: 'initial', replaces_id: null },
    { id: '01935a60-0000-7000-8000-000000000003', component: { id: '01935a50-0000-7000-8000-000000000003', key: 'deposit', label: 'Dépôt de garantie', semantic_key: 'deposit' }, amount: eur(85000), vat_bp: 0, indexed: false, valid_from: '2026-01-01', end_date: null, in_force: true, reason: 'initial', replaces_id: null },
  ],
  parties: [
    { id: IDS.leaseLine, party: { id: IDS.awa, display_name: 'Awa Diallo', kind: 'person', is_anonymized: false }, role: 'tenant', joint_liability: true, guarantees_party_id: null, guarantee: null, valid_from: '2026-01-01', end_date: null },
    { id: IDS.guarantorLine, party: { id: IDS.garant, display_name: 'Paul Garant', kind: 'person', is_anonymized: false }, role: 'guarantor', joint_liability: false, guarantees_party_id: IDS.awa, guarantee: { limit: eur(1000000), ends_on: null }, valid_from: '2026-01-01', end_date: null },
  ],
};

export const unitSummary = (id: string, reference: string) => ({
  id,
  property: { id: IDS.property, name: 'Résidence du Port' },
  parent_unit_id: null,
  unit_type: { id: '01935b60-0000-7000-8000-000000000001', key: 'apartment', label: 'Appartement', semantic_key: 'residential' },
  reference,
  floor: 2,
  surface_hundredths: 6500,
  characteristics: {},
  custom_fields: {},
  lock_version: 1,
  archived_at: null,
});
export const unitsPage = (items: readonly Record<string, unknown>[]) => ({
  data: items,
  links: { first: null, last: null, prev: null, next: null },
  meta: { path: `https://api.test/api/v1/org/${IDS.org}/units`, per_page: 100, next_cursor: null, prev_cursor: null },
});
export const occupancyResponse = {
  data: [
    { unit, vacant: false, since: '2026-01-01', lease: { id: IDS.lease, reference: 'BL-2026-0001', phase: 'running', starts_on: '2026-01-01', end_date: '2028-12-31', tenants: [] } },
    { unit: { id: IDS.annex, reference: 'B3', property: { id: IDS.property, name: 'Résidence du Port' } }, vacant: true, since: null, lease: null },
  ],
};

export const problem = (status: number, code: string, title: string, detail: string, extensions: Record<string, unknown> = {}) => ({
  type: `https://api.test/problems/${code}`,
  title,
  status,
  detail,
  code,
  request_id: '9f8e7d6c',
  ...extensions,
});

export const staleProblem = problem(409, 'party_version_conflict', 'Fiche modifiée entre-temps', 'La fiche a été modifiée depuis sa lecture : rechargez-la avant de renvoyer vos changements.');
