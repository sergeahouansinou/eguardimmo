import { z } from "zod";
import { agencyRef, isoDate, isoInstant, mandantRef, moneySchema, pageOf, singleOf } from "../shared/schemas";

const optionalMoney = moneySchema.nullable();

export const reportSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  status: z.string(),
  agency: agencyRef,
  mandant: mandantRef,
  period: z.object({ kind: z.string(), start: isoDate, end: isoDate }),
  currency: z.string(),
  sections: z.array(z.string()),
  totals: z.object({
    opening_balance: optionalMoney,
    collected: optionalMoney,
    fees: optionalMoney,
    works: optionalMoney,
    payout: optionalMoney,
    adjustments: optionalMoney,
    closing_balance: optionalMoney,
  }),
  supersedes_id: z.string().nullable(),
  published_at: isoInstant.nullable(),
  first_read_at: isoInstant.nullable().optional(),
});

export const reportDetailSchema = reportSchema.extend({
  units: z.array(
    z.object({
      id: z.string(),
      reference: z.string().nullable(),
      property_name: z.string().nullable(),
      lease_reference: z.string().nullable().optional(),
      tenants: z.array(z.string()).optional(),
    }),
  ),
  receipts: z.array(z.object({ number: z.string(), issued_on: z.string().nullable().optional() })),
  lines: z.array(
    z.object({
      position: z.number().int(),
      kind: z.string(),
      date: isoDate,
      unit_id: z.string().nullable(),
      label: z.string(),
      amount: moneySchema,
      direction: z.string(),
      intervention_reference: z.string().nullable(),
    }),
  ),
});

export const reportPageSchema = pageOf(reportSchema);
export const reportResponseSchema = singleOf(reportDetailSchema);

export const reportReadResponseSchema = singleOf(reportSchema);
