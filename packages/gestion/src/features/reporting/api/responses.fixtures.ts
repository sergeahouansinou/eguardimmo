export const IDS = {
  org: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ac001',
  mandantA: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ac002',
  mandantB: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ac003',
  reportDraft: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ac010',
  reportGenerated: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ac011',
  reportPublished: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ac012',
  reportRectified: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ac013',
  unit: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ac020',
  lease: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ac021',
  mandate: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ac022',
};

export const eur = (amount: number) => ({ amount, currency: 'EUR' });

export const party = (id: string, name: string) => ({ data: { id, kind: 'person', display_name: name, last_name: null, first_name: null, company_name: null, is_anonymized: false, archived_at: null } });
export const partyA = party(IDS.mandantA, 'Awa Diallo');
export const partyB = party(IDS.mandantB, 'SCI Les Tilleuls');
export const mandantsPage = {
  data: [
    { party_id: IDS.mandantA, display_name: 'Awa Diallo', mandate_count: 1, running_mandate_count: 1 },
    { party_id: IDS.mandantB, display_name: 'SCI Les Tilleuls', mandate_count: 2, running_mandate_count: 1 },
  ],
};

const rent = { currency: 'EUR', rent_called: eur(70000), rent_collected: eur(68000), collection_rate_basis_points: 9714 };

export const agencyKpis = { data: { month: '2026-11', ...rent, fees_net: eur(4900), period_closed: true } };
export const landlord = { data: { month: '2026-11', ...rent, leases_ending: 2, vacant_units: 1, open_interventions: 3, certificates_to_renew: 4 } };
export const payouts = {
  data: {
    currency: 'EUR',
    payable_total: eur(130000),
    in_transit_total: eur(64120),
    mandants_with_payable: 2,
    top_mandants: [
      { party_id: IDS.mandantA, name: 'Awa Diallo', payable: eur(80000) },
      { party_id: IDS.mandantB, name: null, payable: eur(50000) },
    ],
    active_holds: 1,
    pending_items: 2,
  },
};
export const alerts = {
  data: {
    mandates_to_renew: { count: 1, next: [{ id: IDS.mandate, reference: 'MG-2026-0001', ends_on: '2026-12-20' }] },
    certificates_to_renew: 3,
    reports_due: { period: { start: '2026-10-01', end: '2026-10-31' }, count: 2, mandant_ids: [IDS.mandantA, IDS.mandantB] },
  },
};
export const aging = {
  data: {
    as_of: '2026-11-18',
    currency: 'EUR',
    buckets: [
      { bucket: '0_30', amount: eur(50000), count: 2 },
      { bucket: '31_60', amount: eur(20000), count: 1 },
      { bucket: '61_90', amount: eur(0), count: 0 },
      { bucket: 'over_90', amount: eur(10000), count: 1 },
    ],
    total: eur(80000),
    count: 4,
  },
};

const totals = (overrides: Record<string, unknown> = {}) => ({
  opening_balance: eur(0),
  collected: eur(70000),
  fees: eur(5880),
  works: eur(0),
  payout: eur(64120),
  adjustments: eur(0),
  closing_balance: eur(0),
  ...overrides,
});
const noTotals = {
  opening_balance: null,
  collected: null,
  fees: null,
  works: null,
  payout: null,
  adjustments: null,
  closing_balance: null,
};

const report = (overrides: Record<string, unknown>) => ({
  id: IDS.reportGenerated,
  number: null,
  status: 'generated',
  mandant: { party_id: IDS.mandantA, name: 'Awa Diallo' },
  period: { kind: 'monthly', start: '2026-10-01', end: '2026-10-31' },
  currency: 'EUR',
  sections: ['rent', 'fees', 'payout', 'arrears', 'receipts'],
  options: { letterhead: true, reminder_detail: false, receipts_attached: false },
  totals: totals(),
  template_version: 'CRG-1',
  supersedes_id: null,
  rectification_reason: null,
  scheduled_for: null,
  notify: true,
  generated_at: '2026-11-02T08:00:00+00:00',
  published_at: null,
  first_read_at: null,
  lock_version: 3,
  created_at: '2026-11-02T07:59:00+00:00',
  ...overrides,
});

export const reportDraft = report({
  id: IDS.reportDraft,
  status: 'draft',
  mandant: { party_id: IDS.mandantB, name: null },
  totals: noTotals,
  generated_at: null,
  lock_version: 1,
});
export const reportGenerated = report({});
export const reportPublished = report({
  id: IDS.reportPublished,
  number: 'CR-2026-0001',
  status: 'published',
  period: { kind: 'monthly', start: '2026-09-01', end: '2026-09-30' },
  published_at: '2026-10-05T08:00:00+00:00',
  first_read_at: null,
  lock_version: 5,
});

export const lines = [
  { position: 1, kind: 'rent_called', date: '2026-10-01', unit_id: IDS.unit, lease_id: IDS.lease, mandate_id: IDS.mandate, label: 'Loyer octobre', amount: eur(70000), direction: 'credit' },
  { position: 2, kind: 'fee', date: '2026-10-31', unit_id: null, lease_id: null, mandate_id: IDS.mandate, label: 'Honoraires de gestion', amount: eur(4900), direction: 'debit' },
  { position: 3, kind: 'fee_vat', date: '2026-10-31', unit_id: null, lease_id: null, mandate_id: IDS.mandate, label: 'TVA sur honoraires', amount: eur(980), direction: 'debit' },
  { position: 4, kind: 'payout', date: '2026-11-05', unit_id: null, lease_id: null, mandate_id: null, label: 'Reversement', amount: eur(64120), direction: 'debit' },
];
const detail = {
  lines,
  units: [{ id: IDS.unit, reference: 'Apt 12', property_name: 'Résidence Les Lilas', address: '12 rue des Lilas', mandate_id: IDS.mandate, lease_id: IDS.lease, lease_reference: 'BAIL-1', tenants: ['Jean Martin'] }],
  mandates: [{ id: IDS.mandate, reference: 'MG-2026-0001', status: 'active', fee_kind: 'percentage', fee_basis_points: 700, fee_flat_amount: null, unit_ids: [IDS.unit] }],
};

export const reportDraftDetail = { data: reportDraft };
export const reportGeneratedDetail = { data: { ...reportGenerated, ...detail } };
export const reportPublishedDetail = { data: { ...reportPublished, ...detail } };
export const reportScheduledDetail = { data: { ...reportGenerated, ...detail, scheduled_for: '2026-12-20T10:00:00+00:00' } };
export const reportRectifiedDetail = {
  data: { ...reportGenerated, ...detail, id: IDS.reportRectified, status: 'draft', supersedes_id: IDS.reportPublished, rectification_reason: 'Loyer imputé au mauvais lot', totals: noTotals, lock_version: 1 },
};

export const reportsPage = {
  data: [reportDraft, reportGenerated, reportPublished],
  meta: {
    per_page: 25,
    next_cursor: null,
    due: { period: { start: '2026-10-01', end: '2026-10-31' }, mandants: [{ party_id: IDS.mandantA, name: 'Awa Diallo' }] },
  },
};
export const reportsPageNext = { data: [reportPublished], meta: { per_page: 25, next_cursor: null } };
export const reportsPageFirst = { data: [reportGenerated], meta: { per_page: 25, next_cursor: 'curseur-2', due: { period: { start: '2026-10-01', end: '2026-10-31' }, mandants: [] } } };
export const reportsEmpty = { data: [], meta: { per_page: 25, next_cursor: null, due: { period: { start: '2026-10-01', end: '2026-10-31' }, mandants: [] } } };

export const createdOne = { data: [{ mandant_id: IDS.mandantA, outcome: 'created', report: reportGenerated, error: null }] };
export const createdMixed = {
  data: [
    { mandant_id: IDS.mandantA, outcome: 'created', report: reportGenerated, error: null },
    { mandant_id: IDS.mandantB, outcome: 'failed', report: null, error: { code: 'report_period_overlap', status: 409, detail: 'Un compte rendu vivant ou publié couvre déjà tout ou partie de cette période pour ce mandant.' } },
  ],
};
export const createdAllFailed = {
  data: [{ mandant_id: IDS.mandantA, outcome: 'failed', report: null, error: { code: 'report_period_overlap', status: 409, detail: 'Un compte rendu vivant ou publié couvre déjà tout ou partie de cette période pour ce mandant.' } }],
};

export const statement = {
  data: {
    mandant: { party_id: IDS.mandantA, name: 'Awa Diallo' },
    from: '2026-10-01',
    to: '2026-10-31',
    opening_balance: eur(0),
    closing_balance: eur(5880),
    lines: [
      { date: '2026-10-05', reference: 'PAY-0001', label: 'Encaissement loyer', source: 'owner_allocation', unit_id: IDS.unit, lease_id: IDS.lease, is_reversal: false, debit: eur(0), credit: eur(70000), balance: eur(70000) },
      { date: '2026-10-31', reference: null, label: 'Reversement au mandant', source: 'owner_payout', unit_id: null, lease_id: null, is_reversal: true, debit: eur(64120), credit: eur(0), balance: eur(5880) },
    ],
  },
};

export const problem = (code: string, detail: string) => ({ code, title: detail, detail });
