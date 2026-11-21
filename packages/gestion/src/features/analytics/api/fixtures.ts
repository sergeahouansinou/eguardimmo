import { TEST_ORG, TEST_PROPERTY, TEST_UNIT } from '../../orgapi/testing';

export const IDS = { org: TEST_ORG, property: TEST_PROPERTY, unit: TEST_UNIT, unitTwo: '0198a0a0-0000-7000-8000-0000000000b4' } as const;

const eur = (amount: number) => ({ amount, currency: 'EUR' });

const revenueMonth = (month: string, rent: number, expenses: number, interest: number) => ({
  month,
  revenue: { rent: eur(rent), charges: eur(5_000), fees: eur(0), total: eur(rent + 5_000) },
  expenses: { ledger: eur(expenses), declared: eur(0), total: eur(expenses) },
  financing: { interest: eur(interest), insurance: eur(1_000), total: eur(interest + 1_000) },
  net_before_financing: eur(rent + 5_000 - expenses),
  net_after_financing: eur(rent + 5_000 - expenses - interest - 1_000),
});

export const revenueExpenses = {
  data: {
    from: '2025-11-01',
    to: '2026-11-30',
    currency: 'EUR',
    basis: 'ledger',
    months: [revenueMonth('2026-10', 80_000, 20_000, 30_000), revenueMonth('2026-11', 80_000, 10_000, 30_000)],
    units: [
      { unit_id: IDS.unit, unit_reference: 'Apt 12', property_name: 'Résidence des Lilas', revenue: eur(170_000), expenses: eur(30_000) },
      { unit_id: null, unit_reference: null, property_name: null, revenue: eur(0), expenses: eur(0) },
    ],
    totals: { revenue: eur(170_000), expenses: eur(30_000), financing: eur(62_000), net_before_financing: eur(140_000), net_after_financing: eur(78_000) },
  },
} as const;

export const revenueExpensesEmpty = { data: { ...revenueExpenses.data, months: [], units: [] } };

export const occupancy = {
  data: {
    from: '2026-10-01',
    to: '2026-11-30',
    months: ['2026-10', '2026-11'],
    units: [
      {
        unit_id: IDS.unit,
        unit_reference: 'Apt 12',
        property_name: 'Résidence des Lilas',
        months: [
          { month: '2026-10', state: 'occupied', occupied_days: 31, days: 31 },
          { month: '2026-11', state: 'vacant', occupied_days: 0, days: 30 },
        ],
      },
    ],
    summary: [
      { month: '2026-10', occupied: 1, notice: 0, vacant: 0, occupancy_rate_bp: 10_000 },
      { month: '2026-11', occupied: 0, notice: 0, vacant: 1, occupancy_rate_bp: 0 },
    ],
  },
} as const;

export const occupancyEmpty = { data: { ...occupancy.data, units: [], summary: [] } };

const profitRow = {
  level: 'property',
  property_id: IDS.property,
  property_name: 'Résidence des Lilas',
  unit_id: null,
  unit_reference: null,
  cost: eur(20_000_000),
  acquired_on: '2020-03-01',
  partial_ownership: false,
  rent_collected: eur(960_000),
  expenses_unrecovered: eur(120_000),
  financing: { interest: eur(300_000), insurance: eur(12_000), fees: eur(0), total: eur(312_000) },
  gross_bp: 480,
  net_bp: 420,
  net_after_financing_bp: 264,
  reason: null,
} as const;

export const profitability = {
  data: {
    year: 2026,
    currency: 'EUR',
    from: '2026-01-01',
    to: '2026-11-21',
    partial: true,
    assumptions: { before_tax: true, annualized: false, rounding: 'bp_half_up' },
    rows: [
      profitRow,
      { ...profitRow, property_id: '0198a0a0-0000-7000-8000-0000000000b9', property_name: 'Studio du Port', cost: null, gross_bp: null, net_bp: null, net_after_financing_bp: null, reason: 'cost_missing' },
    ],
    warnings: [{ code: 'unattributed_expenses', property_id: null, amount: eur(15_000) }],
  },
} as const;

export const assumptions = {
  indexation_rate: '1.500',
  expense_growth_rate: '2.000',
  vacancies: [{ unit_id: IDS.unit, from: '2027-02-01', to: '2027-02-28' }],
  one_off_expenses: [{ month: '2027-03', label: 'Ravalement', amount: eur(300_000) }],
  lock_version: 3,
  official_index: false,
} as const;

const forecastMonth = (month: string, closing: number) => ({
  month,
  inflows: { rent: eur(80_000), charges: eur(5_000), total: eur(85_000) },
  outflows: { expenses: eur(20_000), loans: eur(31_000), one_off: eur(0), total: eur(51_000) },
  net: eur(34_000),
  closing: eur(closing),
});

export const forecast = {
  data: {
    kind: 'projection',
    notice: 'Projection indicative, non contractuelle.',
    from: '2026-12-01',
    to: '2027-11-30',
    currency: 'EUR',
    opening: { as_of: '2026-11-21', amount: eur(1_000_000) },
    months: [forecastMonth('2026-12', 1_034_000), forecastMonth('2027-01', 1_068_000)],
    expense_categories: [{ category: 'maintenance', monthly: eur(20_000) }],
    assumptions,
    warnings: [{ code: 'foreign_currency_leases_ignored', count: 2 }],
  },
} as const;

export const assumptionsSaved = { data: { ...assumptions, indexation_rate: '2.000', lock_version: 4 } };
