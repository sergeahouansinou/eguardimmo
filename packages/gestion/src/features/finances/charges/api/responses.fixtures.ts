export const IDS = {
  org: '01934f6e-0000-7000-8000-00000000000b',
  property: '01934f6e-0000-7000-8000-0000000000a1',
  unitA: '01934f6e-0000-7000-8000-0000000000b1',
  unitB: '01934f6e-0000-7000-8000-0000000000b2',
  category: '01934f6e-0000-7000-8000-0000000000c1',
  expense: '01934f6e-0000-7000-8000-0000000000d1',
  expenseTrust: '01934f6e-0000-7000-8000-0000000000d2',
  file: '01934f6e-0000-7000-8000-0000000000e1',
  key: '01934f6e-0000-7000-8000-0000000000f1',
  version: '01934f6e-0000-7000-8000-0000000000f2',
  exercise: '01934f6e-0000-7000-8000-000000000101',
  item: '01934f6e-0000-7000-8000-000000000111',
  statement: '01934f6e-0000-7000-8000-000000000121',
  statementFailed: '01934f6e-0000-7000-8000-000000000122',
  lease: '01934f6e-0000-7000-8000-000000000131',
  leaseB: '01934f6e-0000-7000-8000-000000000132',
  mandant: '01934f6e-0000-7000-8000-000000000141',
  stored: '01934f6e-0000-7000-8000-000000000151',
  stmtFile: '01934f6e-0000-7000-8000-000000000161',
} as const;

export const eur = (amount: number) => ({ amount, currency: 'EUR' as const });
export const xof = (amount: number) => ({ amount, currency: 'XOF' as const });

export const expense = {
  id: IDS.expense,
  property_id: IDS.property,
  unit_id: null,
  kind: 'payment',
  category_term_id: IDS.category,
  payee_party_id: null,
  payee_label: 'Société Propreté Plus',
  reference: 'FAC-2026-014',
  document_on: '2026-03-12',
  service_from: '2026-01-01',
  service_to: '2026-04-01',
  total_gross: eur(120000),
  tax_amount: eur(20000),
  recoverable_amount: eur(100000),
  recoverable_rubric: 'cleaning',
  settlement: 'bank',
  paid_on: '2026-03-15',
  mandate_id: null,
  mandant_party_id: null,
  status: 'recorded',
  cancel_reason: null,
  posted: true,
  files: [IDS.file],
  lock_version: 1,
  created_at: '2026-03-12T09:00:00+00:00',
};

export const expensePending = {
  ...expense,
  id: IDS.expenseTrust,
  settlement: 'trust',
  status: 'pending_approval',
  posted: false,
  mandate_id: '01934f6e-0000-7000-8000-000000000171',
  mandant_party_id: IDS.mandant,
  total_gross: eur(250000),
  files: [],
};

export const cursorMeta = (next: string | null = null) => ({ path: 'https://api.test/x', per_page: 25, next_cursor: next, prev_cursor: null });
export const links = { first: null, last: null, prev: null, next: null };
export const page = <T>(data: T[], next: string | null = null) => ({ data, links, meta: cursorMeta(next) });

export const key = {
  id: IDS.key,
  property_id: IDS.property,
  label: 'Tantièmes généraux',
  kind: 'tantiemes',
  archived: false,
  lock_version: 1,
  versions: [{ id: IDS.version, valid_from: '2026-01-01', valid_to: null, shares: [{ unit_id: IDS.unitA, weight: 640 }, { unit_id: IDS.unitB, weight: 360 }] }],
};

export const exercise = {
  id: IDS.exercise,
  property_id: IDS.property,
  period_start: '2025-01-01',
  period_end: '2026-01-01',
  status: 'draft',
  jurisdiction: 'FR',
  only_lease_id: null,
  prescription_acknowledged: false,
  computed_at: null,
  issued_at: null,
  lock_version: 3,
};

export const statementSummary = {
  id: IDS.statement,
  exercise_id: IDS.exercise,
  lease_id: IDS.lease,
  number: null,
  status: 'computed',
  occupied_days: 365,
  share_total: eur(64000),
  provisions_called: eur(72000),
  provisions_unpaid: eur(0),
  balance: eur(-8000),
  suggested_monthly_provision: eur(5333),
  settlement: 'credit',
  not_before: null,
  mandant_party_id: null,
  issued_at: null,
  supersedes_id: null,
  failure_reason: null,
  lock_version: 1,
};

export const statementFailed = { ...statementSummary, id: IDS.statementFailed, lease_id: IDS.leaseB, number: 'DC-2026-0002', status: 'failed', balance: eur(15000), settlement: 'next_installments', failure_reason: 'charges_pdf_unavailable' };

export const exerciseDetail = {
  ...exercise,
  items: [
    {
      id: IDS.item,
      label: 'Nettoyage des parties communes',
      rubric: 'cleaning',
      key_id: IDS.key,
      unit_id: null,
      position: 1,
      amount: eur(100000),
      owner_share: eur(36000),
      sources: [{ kind: 'expense', id: IDS.expense, amount: eur(100000) }],
      consumptions: [],
    },
  ],
  statements: [statementSummary],
};

export const exerciseComputed = { ...exerciseDetail, status: 'computed', computed_at: '2026-11-16T09:00:00+00:00', excluded_leases: [{ lease_id: IDS.leaseB, reason: 'flat_rate' }] };
export const exerciseIssuing = { ...exerciseDetail, status: 'issuing', statements: [{ ...statementSummary, number: 'DC-2026-0001', status: 'issued', issued_at: '2026-11-16T10:00:00+00:00' }, statementFailed] };
export const exerciseIssued = { ...exerciseDetail, status: 'issued', issued_at: '2026-11-16T10:00:00+00:00', statements: [{ ...statementSummary, number: 'DC-2026-0001', status: 'issued', issued_at: '2026-11-16T10:00:00+00:00' }] };

export const statement = {
  ...statementSummary,
  number: 'DC-2026-0001',
  status: 'issued',
  issued_at: '2026-11-16T10:00:00+00:00',
  plan: null,
  lines: [
    { item_id: IDS.item, label: 'Nettoyage des parties communes', rubric: 'cleaning', split_label: 'Tantièmes 640/1 000', item_amount: eur(100000), weight: 640, denominator: 1000, days: 365, share: eur(64000) },
  ],
  files: [{ id: IDS.stmtFile, label: 'Facture de nettoyage', tenant_visible: false, visible_until: null }],
};

export const terms = {
  data: [
    { id: IDS.category, vocabulary: 'expense_category', key: 'maintenance', labels: { fr: 'Entretien' }, semantic_key: 'expense.maintenance', parent_id: null, position: 1, metadata: { recoverable_by_default: true }, platform: true, system: true, archived: false, hidden: false, overridden: false },
  ],
};
export const rubrics = {
  data: [{ id: '01934f6e-0000-7000-8000-0000000001a1', vocabulary: 'charge_rubric', key: 'cleaning', labels: { fr: 'Entretien des parties communes' }, semantic_key: null, parent_id: null, position: 1, metadata: {}, platform: true, system: true, archived: false, hidden: false, overridden: false }],
};
export const properties = page([{ id: IDS.property, name: 'Résidence des Lilas', type: 'building', address: {}, active_units_count: 2, archived_at: null }]);
export const units = page([
  { id: IDS.unitA, property: { id: IDS.property, name: 'Résidence des Lilas' }, reference: 'Apt 12', surface_hundredths: 6420 },
  { id: IDS.unitB, property: { id: IDS.property, name: 'Résidence des Lilas' }, reference: 'Apt 14', surface_hundredths: null },
]);
