import { IDS } from '../api/responses.fixtures';

export const SIM_IDS = {
  mandateA: IDS.mandate,
  mandateB: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab0a2',
  mandateC: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab0a3',
  type: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab0b1',
  unit: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab0b2',
  property: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab0b3',
  term: '01a1ee5a-0bb7-73fa-a273-ea6cbd9ab0b4',
};

const money = (amount: number, currency = 'EUR') => ({ amount, currency });

const amounts = (source: string, net: number, tax: number, minimumApplied = false) => ({
  source,
  fee_net: money(net),
  tax_amount: money(tax),
  fee_total: money(net + tax),
  minimum_applied: minimumApplied,
});

const monthLine = (month: string, baseRent: number, current: ReturnType<typeof amounts> | null, simulated: ReturnType<typeof amounts>) => ({
  month,
  base_rent: money(baseRent),
  base_charges: money(15000),
  current,
  simulated,
  difference: current === null ? null : { fee_net: money(simulated.fee_net.amount - current.fee_net.amount), fee_total: money(simulated.fee_total.amount - current.fee_total.amount) },
});

const META = { mandate_id: SIM_IDS.mandateA, months_requested: 3, months_returned: 3, currency: 'EUR', reason: null };

export const simulation = {
  data: [
    monthLine('2026-08', 120000, amounts('statement', 9600, 1920), amounts('simulation', 9000, 1800)),
    monthLine('2026-09', 120000, amounts('computed', 9600, 1920), amounts('simulation', 9000, 1800)),
    monthLine('2026-10', 40000, amounts('computed', 3200, 640), amounts('simulation', 5000, 1000, true)),
  ],
  meta: {
    ...META,
    totals: {
      simulated_fee_net: money(23000),
      simulated_fee_total: money(27600),
      current_fee_net: money(22400),
      current_fee_total: money(26880),
      difference_fee_net: money(600),
      difference_fee_total: money(720),
    },
  },
};

export const simulationWithoutCurrent = {
  data: [monthLine('2026-10', 120000, null, amounts('simulation', 9000, 1800))],
  meta: {
    ...META,
    months_returned: 1,
    totals: {
      simulated_fee_net: money(9000),
      simulated_fee_total: money(10800),
      current_fee_net: null,
      current_fee_total: null,
      difference_fee_net: null,
      difference_fee_total: null,
    },
  },
};

export const simulationEmpty = { data: [], meta: { ...META, months_returned: 0, reason: 'no_closed_period', totals: null } };

const party = { id: IDS.mandantA, display_name: 'Awa Diallo', kind: 'person', is_anonymized: false };
const type = { id: SIM_IDS.type, key: 'gestion', label: 'Mandat de gestion', semantic_key: 'management' };
const unit = { id: SIM_IDS.unit, unit: { id: SIM_IDS.unit, reference: 'A12', property: { id: SIM_IDS.property, name: 'Résidence Les Tilleuls' } }, valid_from: '2026-01-01', end_date: null };

const terms = (overrides: Record<string, unknown>) => ({
  id: SIM_IDS.term,
  fee_kind: 'percentage',
  fee_basis_points: 800,
  fee_flat_amount: null,
  payout_day: 10,
  works_limit_amount: money(50000),
  fee_base: 'rent',
  fee_minimum_amount: money(0),
  fee_tax_mode: 'excl_tax',
  letting_fee_basis_points: null,
  works_fee_basis_points: null,
  signed_file_id: null,
  valid_from: '2026-01-01',
  valid_to: null,
  reason: 'initial',
  ...overrides,
});

const mandate = (id: string, reference: string, overrides: Record<string, unknown>) => ({
  id,
  reference,
  status: 'active',
  mandant: party,
  mandate_type: type,
  starts_on: '2026-01-01',
  end_date: '2028-12-31',
  tacit_renewal: false,
  currency: 'EUR',
  units: [unit],
  terms: terms({}),
  lock_version: 3,
  archived_at: null,
  ...overrides,
});

export const mandatesPage = (nextCursor: string | null = null, data: object[] = [
  mandate(SIM_IDS.mandateA, 'M-2026-0001', {}),
  mandate(SIM_IDS.mandateB, 'M-2026-0002', {
    currency: 'XOF',
    mandant: { ...party, display_name: 'SCI Les Tilleuls', kind: 'company' },
    terms: terms({ fee_kind: 'flat', fee_basis_points: null, fee_flat_amount: money(50000, 'XOF'), fee_base: 'rent_and_charges', fee_minimum_amount: money(25000, 'XOF'), fee_tax_mode: 'incl_tax', works_limit_amount: money(500000, 'XOF') }),
  }),
  mandate(SIM_IDS.mandateC, 'M-2026-0003', { terms: null }),
]) => ({ data, meta: { per_page: 100, next_cursor: nextCursor } });

export const mandatesEmpty = mandatesPage(null, []);

const problem = (status: number, code: string, title: string, detail: string, errors?: Record<string, string[]>) => ({
  type: `https://api.test/problems/${code}`,
  title,
  status,
  detail,
  code,
  ...(errors ? { errors } : {}),
});

export const problemMandateNotFound = problem(404, 'owner_funds_mandate_not_found', 'Mandat introuvable', 'Ce mandat n’existe pas dans votre organisation.');
export const problemFeeBaseMissing = problem(422, 'fee_base_missing', 'Base des honoraires manquante', 'Le barème proposé n’indique pas la base des honoraires.');
export const problemAmountTooHigh = problem(422, 'validation_failed', 'Validation échouée', 'Les données sont invalides.', {
  fee_flat_amount: ['The fee flat amount field must not be greater than 100000000000.'],
});
export const problemRateLimited = problem(429, 'too_many_requests', 'Trop de requêtes', 'Trop de tentatives.');
