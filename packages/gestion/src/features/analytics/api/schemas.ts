import { z } from 'zod';
import { CURRENCIES } from '../../../format/money';
import { OCCUPANCY_STATES } from '../model';

const id = z.guid();
const isoDate = z.iso.date();
const month = z.string().regex(/^\d{4}-\d{2}$/);
const money = z.object({ amount: z.number().int(), currency: z.enum(CURRENCIES) });
const currency = z.enum(CURRENCIES);
const label = z.string().nullable();

export const apiRevenueExpenses = z.object({
  data: z.object({
    from: isoDate,
    to: isoDate,
    currency,
    basis: z.literal('ledger'),
    months: z.array(
      z.object({
        month,
        revenue: z.object({ rent: money, charges: money, fees: money, total: money }),
        expenses: z.object({ ledger: money, declared: money, total: money }),
        financing: z.object({ interest: money, insurance: money, total: money }),
        net_before_financing: money,
        net_after_financing: money,
      }),
    ),
    units: z.array(z.object({ unit_id: id.nullable(), unit_reference: label, property_name: label, revenue: money, expenses: money })),
    totals: z.object({ revenue: money, expenses: money, financing: money, net_before_financing: money, net_after_financing: money }),
  }),
});

export const apiOccupancy = z.object({
  data: z.object({
    from: isoDate,
    to: isoDate,
    months: z.array(month),
    units: z.array(
      z.object({
        unit_id: id,
        unit_reference: label,
        property_name: label,
        months: z.array(z.object({ month, state: z.enum(OCCUPANCY_STATES), occupied_days: z.number().int(), days: z.number().int() })),
      }),
    ),
    summary: z.array(z.object({ month, occupied: z.number().int(), notice: z.number().int(), vacant: z.number().int(), occupancy_rate_bp: z.number().int().nullable() })),
  }),
});

export const apiProfitability = z.object({
  data: z.object({
    year: z.number().int(),
    currency,
    from: isoDate,
    to: isoDate,
    partial: z.boolean(),
    assumptions: z.record(z.string(), z.union([z.string(), z.boolean()])),
    rows: z.array(
      z.object({
        level: z.enum(['property', 'unit']),
        property_id: id,
        property_name: label,
        unit_id: id.nullable(),
        unit_reference: label,
        cost: money.nullable(),
        acquired_on: isoDate.nullable(),
        partial_ownership: z.boolean(),
        rent_collected: money,
        expenses_unrecovered: money,
        financing: z.object({ interest: money, insurance: money, fees: money, total: money }),
        gross_bp: z.number().int().nullable(),
        net_bp: z.number().int().nullable(),
        net_after_financing_bp: z.number().int().nullable(),
        reason: z.enum(['cost_missing', 'not_yet_acquired']).nullable(),
      }),
    ),
    warnings: z.array(z.object({ code: z.string(), property_id: id.nullable(), amount: money })),
  }),
});

const assumptions = z.object({
  indexation_rate: z.string().regex(/^\d+(\.\d+)?$/),
  expense_growth_rate: z.string().regex(/^\d+(\.\d+)?$/),
  vacancies: z.array(z.object({ unit_id: id, from: isoDate, to: isoDate })),
  one_off_expenses: z.array(z.object({ month, label: z.string(), amount: money })),
  lock_version: z.number().int().nonnegative(),
  official_index: z.literal(false),
});

export const apiAssumptionsOne = z.object({ data: assumptions });

export const apiForecast = z.object({
  data: z.object({
    kind: z.literal('projection'),
    notice: z.string(),
    from: isoDate,
    to: isoDate,
    currency,
    opening: z.object({ as_of: isoDate, amount: money }),
    months: z.array(
      z.object({
        month,
        inflows: z.object({ rent: money, charges: money, total: money }),
        outflows: z.object({ expenses: money, loans: money, one_off: money, total: money }),
        net: money,
        closing: money,
      }),
    ),
    expense_categories: z.array(z.object({ category: z.string(), monthly: money })),
    assumptions,
    warnings: z.array(z.object({ code: z.string(), count: z.number().int() })),
  }),
});

export type ApiRevenueExpenses = z.infer<typeof apiRevenueExpenses>['data'];
export type ApiOccupancy = z.infer<typeof apiOccupancy>['data'];
export type ApiProfitability = z.infer<typeof apiProfitability>['data'];
export type ApiForecast = z.infer<typeof apiForecast>['data'];
export type ApiAssumptions = z.infer<typeof assumptions>;
