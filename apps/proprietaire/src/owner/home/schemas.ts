import { z } from "zod";
import { agencyRef, isoDate, isoInstant, moneySchema, singleOf } from "../shared/schemas";

const mandate = z.object({
  id: z.uuid(),
  reference: z.string(),
  status: z.string(),
  is_suspended: z.boolean(),
  starts_on: isoDate,
  end_date: isoDate.nullable(),
  fee_kind: z.string(),
  fee_basis_points: z.number().int().nullable(),
  fee_flat_amount: moneySchema.nullable(),
  payout_day: z.number().int(),
});

const payouts = z.object({
  pending: z.object({ net: moneySchema, fees: moneySchema }).nullable(),
  last: z.object({ amount: moneySchema, date: isoDate.nullable(), number: z.string().nullable() }).nullable(),
  next_date: isoDate.nullable(),
  next_notice: z.string().nullable(),
});

const lastReport = z.object({
  id: z.uuid(),
  number: z.string(),
  status: z.string(),
  period: z.object({ kind: z.string(), start: isoDate, end: isoDate }),
  published_at: isoInstant.nullable(),
  first_read_at: isoInstant.nullable(),
  is_read: z.boolean(),
});

const unit = z.object({
  id: z.uuid(),
  reference: z.string(),
  property_name: z.string(),
  label: z.string(),
  type: z.string(),
  surface_hundredths: z.number().int().nullable(),
  state: z.enum(["vacant", "occupied", "late"]),
  tenant: z.object({ name: z.string() }).nullable(),
  rent: moneySchema.nullable(),
  collected: moneySchema,
});

export const homeSchema = singleOf(
  z.object({
    agency: agencyRef,
    mandant: z.object({ name: z.string(), role: z.string() }),
    access: z.object({ in_grace: z.boolean(), until: isoDate.nullable() }),
    currency: z.string().regex(/^[A-Z]{3}$/),
    mandate: mandate.nullable(),
    mandates_count: z.number().int(),
    month: z.object({
      period: z.string().regex(/^\d{4}-\d{2}$/),
      from: isoDate,
      to: isoDate,
      called: moneySchema,
      collected: moneySchema,
      arrears: z.object({ amount: moneySchema, count: z.number().int(), max_days_late: z.number().int() }),
    }),
    payouts: payouts.nullable(),
    last_report: lastReport.nullable(),
    counters: z.object({ units_total: z.number().int(), units_occupied: z.number().int(), units_vacant: z.number().int(), quotes_to_decide: z.number().int() }),
    units: z.array(unit),
  }),
);
