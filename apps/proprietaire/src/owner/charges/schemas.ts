import { z } from "zod";
import { isoDate, isoInstant, moneySchema, singleOf } from "../shared/schemas";

export const statementSchema = z.object({
  id: z.uuid(),
  number: z.string().nullable(),
  status: z.string(),
  agency_name: z.string().nullable(),
  period: z.object({ start: isoDate.nullable(), end: isoDate.nullable() }),
  tenant_names: z.array(z.string()),
  unit: z.object({ reference: z.string().nullable(), property_name: z.string().nullable() }),
  share_total: moneySchema,
  provisions_called: moneySchema,
  balance: moneySchema,
  issued_at: isoInstant.nullable(),
});

export const statementDetailSchema = statementSchema.extend({
  lines: z.array(
    z.object({
      label: z.string(),
      split_label: z.string(),
      item_amount: moneySchema,
      days: z.number().int(),
      share: moneySchema,
    }),
  ),
});

export const statementPageSchema = z.object({ data: z.array(statementSchema), next_cursor: z.string().nullable() });
export const statementResponseSchema = singleOf(statementDetailSchema);
