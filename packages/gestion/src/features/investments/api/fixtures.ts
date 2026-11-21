import { TEST_ORG, TEST_PROPERTY, TEST_UNIT } from '../../orgapi/testing';

export const IDS = {
  org: TEST_ORG,
  property: TEST_PROPERTY,
  unit: TEST_UNIT,
  loan: '0198d000-0000-7000-8000-000000000001',
  loanTwo: '0198d000-0000-7000-8000-000000000002',
  fee: '0198d000-0000-7000-8000-000000000011',
  attestation: '0198d000-0000-7000-8000-000000000012',
  acquisition: '0198d000-0000-7000-8000-000000000021',
  file: '0198d000-0000-7000-8000-000000000031',
} as const;

const eur = (amount: number) => ({ amount, currency: 'EUR' });

export const loanBase = {
  id: IDS.loan,
  property_id: IDS.property,
  unit_id: null,
  lender_label: 'Banque Populaire',
  contract_reference: '…0001',
  purpose: 'acquisition',
  principal: eur(15_000_000),
  nominal_rate: '3.45000',
  first_due_on: '2025-02-05',
  term_months: 240,
  deferral_kind: 'none',
  deferral_months: 0,
  insurance_mode: 'none',
  insurance_rate: null,
  insurance_amount: null,
  replaces_loan_id: null,
  schedule_source: 'computed',
  status: 'active',
  void_reason: null,
  repaid_on: null,
  stored_file_id: null,
  outstanding: { as_of: '2026-11-21', amount: eur(13_800_000), basis: 'schedule' },
  lock_version: 3,
  created_at: '2025-01-10T09:00:00+00:00',
} as const;

export const loanTwo = { ...loanBase, id: IDS.loanTwo, lender_label: 'Crédit Mutuel', purpose: 'works', status: 'voided', void_reason: 'Saisie en double', lock_version: 5 };

export const loanDetail = {
  ...loanBase,
  contract_reference: 'PRET-2025-0001',
  fees: [{ id: IDS.fee, kind: 'dossier', paid_on: '2025-01-10', amount: eur(150_000), stored_file_id: null }],
  attestations: [{ id: IDS.attestation, income_year: 2025, interest: eur(480_000), insurance: eur(0), fees: eur(0), stored_file_id: IDS.file }],
};

export const schedule = {
  loan_id: IDS.loan,
  source: 'computed',
  currency: 'EUR',
  lines: [
    { position: 1, due_on: '2025-02-05', payment: eur(86_000), interest: eur(43_125), principal: eur(42_875), insurance: eur(0), total: eur(86_000), outstanding_after: eur(14_957_125) },
    { position: 2, due_on: '2026-12-05', payment: eur(86_000), interest: eur(42_000), principal: eur(44_000), insurance: eur(2_000), total: eur(88_000), outstanding_after: eur(13_756_000) },
    { position: 3, due_on: '2027-01-05', payment: eur(86_000), interest: eur(41_000), principal: eur(45_000), insurance: eur(2_000), total: eur(88_000), outstanding_after: eur(13_711_000) },
  ],
  totals: { interest: eur(126_125), insurance: eur(4_000), principal: eur(131_875) },
};

export const acquisition = {
  id: IDS.acquisition,
  property_id: IDS.property,
  unit_id: null,
  acquired_on: '2025-01-10',
  price: eur(20_000_000),
  acquisition_costs: eur(1_500_000),
  agency_fees: eur(500_000),
  initial_works: eur(1_000_000),
  cost: eur(23_000_000),
  stored_file_id: null,
  lock_version: 1,
  created_at: '2025-01-10T09:00:00+00:00',
  updated_at: '2025-01-10T09:00:00+00:00',
} as const;

export const organization = { data: { id: IDS.org, kind: 'individual', name: 'Camille Martin', country: 'FR', currency: 'EUR', timezone: 'Europe/Paris', two_factor_required: false } };
