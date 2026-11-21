import { z } from "zod";
import { agencyRef, isoDate, mandantRef, moneySchema, pageOf, singleOf } from "../shared/schemas";

const amounts = z.object({ called: moneySchema, collected: moneySchema, fees: moneySchema, works: moneySchema, net: moneySchema });

export const rentSchema = singleOf(
  z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    mandants: z.array(
      z.object({
        agency: agencyRef,
        mandant: z.object({ name: z.string().nullable(), role: z.string() }),
        currency: z.string(),
        units: z.array(
          z.object({
            unit: z.object({ id: z.uuid(), reference: z.string(), property_name: z.string() }),
            amounts,
            arrears: moneySchema.nullable(),
          }),
        ),
        others: amounts,
        totals: amounts,
      }),
    ),
  }),
);

const payout = z.object({
  id: z.uuid(),
  number: z.string(),
  status: z.string(),
  date: isoDate.nullable(),
  amount: moneySchema,
  bank_last4: z.string().nullable(),
  agency: agencyRef,
  mandant: mandantRef,
});

const upcoming = z.object({
  agency: agencyRef,
  mandant: z.object({ name: z.string().nullable() }),
  date: isoDate.nullable(),
  notice: z.object({ code: z.string(), message: z.string() }).nullable(),
});

export const payoutPageSchema = pageOf(payout).extend({ upcoming: z.array(upcoming).default([]) });
