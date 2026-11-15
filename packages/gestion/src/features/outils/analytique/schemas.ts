import { z } from 'zod';
import { EXPENSE_CATEGORY_IDS, LOT_TYPE_IDS, OCCUPANCY_STATUSES } from './constants';

const cents = z.number().int();
const month = z.string().regex(/^\d{4}-\d{2}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const buildingSchema = z.object({ id: z.string(), name: z.string() });

export const lotSchema = z.object({
  id: z.string(),
  name: z.string(),
  buildingId: z.string(),
  type: z.enum(LOT_TYPE_IDS),
  monthlyRent: cents,
  annualCharges: cents,
  costPrice: cents,
  annualLoanInterest: cents,
  candidates: z.number().int().nonnegative(),
  previous: z.object({ monthlyRent: cents, annualCharges: cents, costPrice: cents }),
});

export const revenueSchema = z.object({
  lotId: z.string(),
  month,
  loyers: cents,
  charges: cents,
  autres: cents,
  called: cents,
});

export const expenseSchema = z.object({
  lotId: z.string(),
  month,
  category: z.enum(EXPENSE_CATEGORY_IDS),
  amount: cents,
  recoverable: cents,
});

export const occupancySchema = z.object({
  lotId: z.string(),
  month,
  status: z.enum(OCCUPANCY_STATUSES),
});

export const arrearsSchema = z.object({
  lotId: z.string(),
  tenant: z.string(),
  amount: cents.positive(),
  dueSince: isoDate,
});

export const leaseEndSchema = z.object({
  lotId: z.string(),
  date: isoDate,
  kind: z.enum(['preavis', 'reconduction', 'etudiant']),
});

const forecastBuildingSchema = z.object({
  buildingId: z.string(),
  baseRent: cents,
  recurring: cents,
  loan: cents,
  openingCash: cents,
  oneOffWeight: z.number().int().positive(),
  irl: z.array(z.object({ index: z.number().int().min(0).max(11), delta: cents })),
  vacancies: z.array(
    z.object({
      lotId: z.string(),
      fromIndex: z.number().int().min(0),
      toIndex: z.number().int().min(0),
      rent: cents,
    }),
  ),
  other: z.array(z.object({ index: z.number().int().min(0).max(11), amount: cents })),
  reference: z.object({ inflows: cents, outflows: cents, balance: cents }),
});

export const forecastSchema = z.object({
  startMonth: month,
  referenceIrlBp: z.number().int().positive(),
  irlBp: z.number().int().nonnegative(),
  growthBp: z.number().int().nonnegative(),
  oneOff: z.array(cents).length(12),
  buildings: z.array(forecastBuildingSchema),
});

export const analytiqueDataSchema = z.object({
  generatedAt: z.string(),
  buildings: z.array(buildingSchema),
  lots: z.array(lotSchema),
  revenues: z.array(revenueSchema),
  expenses: z.array(expenseSchema),
  occupancy: z.array(occupancySchema),
  arrears: z.array(arrearsSchema),
  leaseEnds: z.array(leaseEndSchema),
  forecast: forecastSchema,
});

export type Building = z.infer<typeof buildingSchema>;
export type Lot = z.infer<typeof lotSchema>;
export type Revenue = z.infer<typeof revenueSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type OccupancyCell = z.infer<typeof occupancySchema>;
export type Arrears = z.infer<typeof arrearsSchema>;
export type LeaseEnd = z.infer<typeof leaseEndSchema>;
export type Forecast = z.infer<typeof forecastSchema>;
export type ForecastBuilding = z.infer<typeof forecastBuildingSchema>;
export type AnalytiqueData = z.infer<typeof analytiqueDataSchema>;
