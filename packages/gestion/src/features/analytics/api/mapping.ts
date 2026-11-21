import type { Forecast, ForecastAssumptions, Occupancy, Profitability, RevenueExpenses } from '../model';
import type { ApiAssumptions, ApiForecast, ApiOccupancy, ApiProfitability, ApiRevenueExpenses } from './schemas';

export const toRevenueExpenses = (api: ApiRevenueExpenses): RevenueExpenses => ({
  from: api.from,
  to: api.to,
  currency: api.currency,
  months: api.months.map((month) => ({
    month: month.month,
    revenue: month.revenue,
    expenses: month.expenses,
    financing: month.financing,
    netBeforeFinancing: month.net_before_financing,
    netAfterFinancing: month.net_after_financing,
  })),
  units: api.units.map((unit) => ({ unitId: unit.unit_id, unitReference: unit.unit_reference, propertyName: unit.property_name, revenue: unit.revenue, expenses: unit.expenses })),
  totals: {
    revenue: api.totals.revenue,
    expenses: api.totals.expenses,
    financing: api.totals.financing,
    netBeforeFinancing: api.totals.net_before_financing,
    netAfterFinancing: api.totals.net_after_financing,
  },
});

export const toOccupancy = (api: ApiOccupancy): Occupancy => ({
  from: api.from,
  to: api.to,
  months: api.months,
  units: api.units.map((unit) => ({
    unitId: unit.unit_id,
    unitReference: unit.unit_reference,
    propertyName: unit.property_name,
    months: unit.months.map((month) => ({ month: month.month, state: month.state, occupiedDays: month.occupied_days, days: month.days })),
  })),
  summary: api.summary.map((row) => ({ month: row.month, occupied: row.occupied, notice: row.notice, vacant: row.vacant, occupancyRateBp: row.occupancy_rate_bp })),
});

export const toProfitability = (api: ApiProfitability): Profitability => ({
  year: api.year,
  currency: api.currency,
  from: api.from,
  to: api.to,
  partial: api.partial,
  assumptions: api.assumptions,
  rows: api.rows.map((row) => ({
    level: row.level,
    propertyId: row.property_id,
    propertyName: row.property_name,
    unitId: row.unit_id,
    unitReference: row.unit_reference,
    cost: row.cost,
    acquiredOn: row.acquired_on,
    partialOwnership: row.partial_ownership,
    rentCollected: row.rent_collected,
    expensesUnrecovered: row.expenses_unrecovered,
    financing: row.financing,
    grossBp: row.gross_bp,
    netBp: row.net_bp,
    netAfterFinancingBp: row.net_after_financing_bp,
    reason: row.reason,
  })),
  warnings: api.warnings.map((warning) => ({ code: warning.code, propertyId: warning.property_id, amount: warning.amount })),
});

export const toAssumptions = (api: ApiAssumptions): ForecastAssumptions => ({
  indexationRate: api.indexation_rate,
  expenseGrowthRate: api.expense_growth_rate,
  vacancies: api.vacancies.map((vacancy) => ({ unitId: vacancy.unit_id, from: vacancy.from, to: vacancy.to })),
  oneOffExpenses: api.one_off_expenses,
  lockVersion: api.lock_version,
});

export const toForecast = (api: ApiForecast): Forecast => ({
  notice: api.notice,
  from: api.from,
  to: api.to,
  currency: api.currency,
  opening: { asOf: api.opening.as_of, amount: api.opening.amount },
  months: api.months.map((month) => ({
    month: month.month,
    inflows: month.inflows,
    outflows: { expenses: month.outflows.expenses, loans: month.outflows.loans, oneOff: month.outflows.one_off, total: month.outflows.total },
    net: month.net,
    closing: month.closing,
  })),
  expenseCategories: api.expense_categories,
  assumptions: toAssumptions(api.assumptions),
  warnings: api.warnings,
});
