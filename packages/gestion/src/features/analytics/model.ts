import type { Currency } from '../../format/money';
import type { Money } from '../investments/model';

export interface MonthRevenue {
  rent: Money;
  charges: Money;
  fees: Money;
  total: Money;
}

export interface MonthExpenses {
  ledger: Money;
  declared: Money;
  total: Money;
}

export interface MonthFinancing {
  interest: Money;
  insurance: Money;
  total: Money;
}

export interface RevenueExpensesMonth {
  month: string;
  revenue: MonthRevenue;
  expenses: MonthExpenses;
  financing: MonthFinancing;
  netBeforeFinancing: Money;
  netAfterFinancing: Money;
}

export interface RevenueExpenses {
  from: string;
  to: string;
  currency: Currency;
  months: RevenueExpensesMonth[];
  units: { unitId: string | null; unitReference: string | null; propertyName: string | null; revenue: Money; expenses: Money }[];
  totals: { revenue: Money; expenses: Money; financing: Money; netBeforeFinancing: Money; netAfterFinancing: Money };
}

export const OCCUPANCY_STATES = ['occupied', 'notice', 'vacant'] as const;
export type OccupancyState = (typeof OCCUPANCY_STATES)[number];

export interface Occupancy {
  from: string;
  to: string;
  months: string[];
  units: { unitId: string; unitReference: string | null; propertyName: string | null; months: { month: string; state: OccupancyState; occupiedDays: number; days: number }[] }[];
  summary: { month: string; occupied: number; notice: number; vacant: number; occupancyRateBp: number | null }[];
}

export type ProfitabilityReason = 'cost_missing' | 'not_yet_acquired';

export interface ProfitabilityRow {
  level: 'property' | 'unit';
  propertyId: string;
  propertyName: string | null;
  unitId: string | null;
  unitReference: string | null;
  cost: Money | null;
  acquiredOn: string | null;
  partialOwnership: boolean;
  rentCollected: Money;
  expensesUnrecovered: Money;
  financing: { interest: Money; insurance: Money; fees: Money; total: Money };
  grossBp: number | null;
  netBp: number | null;
  netAfterFinancingBp: number | null;
  reason: ProfitabilityReason | null;
}

export interface Profitability {
  year: number;
  currency: Currency;
  from: string;
  to: string;
  partial: boolean;
  assumptions: Record<string, string | boolean>;
  rows: ProfitabilityRow[];
  warnings: { code: string; propertyId: string | null; amount: Money }[];
}

export interface Vacancy {
  unitId: string;
  from: string;
  to: string;
}

export interface OneOffExpense {
  month: string;
  label: string;
  amount: Money;
}

export interface ForecastAssumptions {
  indexationRate: string;
  expenseGrowthRate: string;
  vacancies: Vacancy[];
  oneOffExpenses: OneOffExpense[];
  lockVersion: number;
}

export interface ForecastMonth {
  month: string;
  inflows: { rent: Money; charges: Money; total: Money };
  outflows: { expenses: Money; loans: Money; oneOff: Money; total: Money };
  net: Money;
  closing: Money;
}

export interface Forecast {
  notice: string;
  from: string;
  to: string;
  currency: Currency;
  opening: { asOf: string; amount: Money };
  months: ForecastMonth[];
  expenseCategories: { category: string; monthly: Money }[];
  assumptions: ForecastAssumptions;
  warnings: { code: string; count: number }[];
}

export interface AssumptionsInput {
  indexationRate: string;
  expenseGrowthRate: string;
  vacancies: Vacancy[];
  oneOffExpenses: { month: string; label: string; amount: number }[];
  lockVersion: number;
}

export interface Period {
  from: string;
  to: string;
}

export type ExportRequest = { type: 'prets-immobiliers'; from: string; to: string } | { type: 'rentabilite-par-bien'; year: number };
