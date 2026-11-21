import { z } from "zod";
import { isoDate, moneySchema, singleOf } from "../shared/schemas";

const line = z.object({
  date: isoDate,
  reference: z.string(),
  label: z.string(),
  source: z.string(),
  unit_id: z.string().nullable(),
  lease_id: z.string().nullable(),
  is_reversal: z.boolean(),
  debit: moneySchema,
  credit: moneySchema,
  balance: moneySchema,
});

export const statementSchema = singleOf(
  z.object({
    mandant: z.object({ party_id: z.uuid(), name: z.string() }),
    from: isoDate,
    to: isoDate,
    opening_balance: moneySchema,
    closing_balance: moneySchema,
    lines: z.array(line),
  }),
);
