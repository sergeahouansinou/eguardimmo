import { z } from 'zod';
import { isoDate, moneySchema } from './schemas';

const line = z.object({
  label: z.string(),
  split_label: z.string(),
  item_amount: moneySchema,
  days: z.number().int().nonnegative(),
  share: moneySchema,
});

const file = z.object({ id: z.uuid(), label: z.string(), visible_until: isoDate.nullable() });

const statement = z.object({
  id: z.uuid(),
  lease_id: z.uuid(),
  number: z.string(),
  status: z.enum(['issued', 'superseded']),
  period: z.object({ start: isoDate.nullable(), end: isoDate.nullable() }),
  occupied_days: z.number().int().nonnegative(),
  share_total: moneySchema,
  provisions_called: moneySchema,
  balance: moneySchema,
  suggested_monthly_provision: moneySchema,
  settlement: z.enum(['next_installments', 'plan_12', 'standalone_installment', 'credit', 'none']).nullable(),
  not_before: isoDate.nullable(),
  issued_at: z.iso.datetime({ offset: true }).nullable(),
  files: z.array(file),
});

export type ApiChargeStatement = z.infer<typeof statement> & { lines?: z.infer<typeof line>[] };

export const chargeStatementPageSchema = z.object({ data: z.array(statement), next_cursor: z.string().nullable() });
export const chargeStatementSchema = z.object({ data: statement.extend({ lines: z.array(line) }) });
