import { z } from 'zod';
import { CURRENCIES } from '../../../../format/money';
import { EXERCISE_STATUSES, EXPENSE_KINDS, EXPENSE_SETTLEMENTS, EXPENSE_STATUSES, KEY_KINDS, SOURCE_KINDS, STATEMENT_SETTLEMENTS, STATEMENT_STATUSES } from '../model';

const id = z.guid();
const timestamp = z.iso.datetime({ offset: true });
const isoDate = z.iso.date();
const count = z.number().int().nonnegative();
const money = z.object({ amount: z.number().int(), currency: z.enum(CURRENCIES) });
const cursorMeta = z.object({ per_page: count, next_cursor: z.string().nullable() });

export const apiExpenseSchema = z.object({
  id,
  property_id: id,
  unit_id: id.nullable(),
  kind: z.enum(EXPENSE_KINDS),
  category_term_id: id,
  payee_party_id: id.nullable(),
  payee_label: z.string().nullable(),
  reference: z.string().nullable(),
  document_on: isoDate,
  service_from: isoDate,
  service_to: isoDate,
  total_gross: money,
  tax_amount: money,
  recoverable_amount: money,
  recoverable_rubric: z.string().nullable(),
  settlement: z.enum(EXPENSE_SETTLEMENTS),
  paid_on: isoDate.nullable(),
  mandate_id: id.nullable(),
  mandant_party_id: id.nullable(),
  status: z.enum(EXPENSE_STATUSES),
  cancel_reason: z.string().nullable(),
  posted: z.boolean(),
  files: z.array(id),
  lock_version: z.number().int().positive(),
  created_at: timestamp.nullable(),
});

export const apiKeySchema = z.object({
  id,
  property_id: id,
  label: z.string(),
  kind: z.enum(KEY_KINDS),
  archived: z.boolean(),
  lock_version: z.number().int().positive(),
  versions: z.array(
    z.object({
      id,
      valid_from: isoDate,
      valid_to: isoDate.nullable(),
      shares: z.array(z.object({ unit_id: id, weight: count })),
    }),
  ),
});

export const apiStatementSummarySchema = z.object({
  id,
  exercise_id: id,
  lease_id: id,
  number: z.string().nullable(),
  status: z.enum(STATEMENT_STATUSES),
  occupied_days: count,
  share_total: money,
  provisions_called: money,
  provisions_unpaid: money,
  balance: money,
  suggested_monthly_provision: money,
  settlement: z.enum(STATEMENT_SETTLEMENTS).nullable(),
  not_before: isoDate.nullable(),
  mandant_party_id: id.nullable(),
  issued_at: timestamp.nullable(),
  supersedes_id: id.nullable(),
  failure_reason: z.string().nullable(),
  lock_version: z.number().int().positive(),
});

export const apiExerciseSchema = z.object({
  id,
  property_id: id,
  period_start: isoDate,
  period_end: isoDate,
  status: z.enum(EXERCISE_STATUSES),
  jurisdiction: z.string(),
  only_lease_id: id.nullable(),
  prescription_acknowledged: z.boolean(),
  computed_at: timestamp.nullable(),
  issued_at: timestamp.nullable(),
  lock_version: z.number().int().positive(),
});

export const apiExerciseDetailSchema = apiExerciseSchema.extend({
  items: z.array(
    z.object({
      id,
      label: z.string(),
      rubric: z.string(),
      key_id: id.nullable(),
      unit_id: id.nullable(),
      position: count,
      amount: money,
      owner_share: money,
      sources: z.array(z.object({ kind: z.enum(SOURCE_KINDS), id, amount: money })),
      consumptions: z.array(z.object({ unit_id: id, quantity_milli: z.number().int().positive() })),
    }),
  ),
  statements: z.array(apiStatementSummarySchema),
  excluded_leases: z.array(z.object({ lease_id: id, reason: z.string() })).optional(),
});

export const apiStatementSchema = apiStatementSummarySchema.extend({
  plan: z.object({ id, reason: z.string(), recorded_at: timestamp.nullable() }).nullable(),
  lines: z.array(
    z.object({
      item_id: id,
      label: z.string(),
      rubric: z.string(),
      split_label: z.string(),
      item_amount: money,
      weight: z.number().int().nullable(),
      denominator: z.number().int().nullable(),
      days: count,
      share: money,
    }),
  ),
  files: z.array(z.object({ id, label: z.string(), tenant_visible: z.boolean(), visible_until: isoDate.nullable() })),
});

export const apiExpensePage = z.object({ data: z.array(apiExpenseSchema), meta: cursorMeta });
export const apiExpenseResponse = z.object({ data: apiExpenseSchema });
export const apiKeyList = z.object({ data: z.array(apiKeySchema) });
export const apiKeyResponse = z.object({ data: apiKeySchema });
export const apiExercisePage = z.object({ data: z.array(apiExerciseSchema), meta: cursorMeta });
export const apiExerciseResponse = z.object({ data: apiExerciseDetailSchema });
export const apiExerciseHeaderResponse = z.object({ data: apiExerciseSchema });
export const apiStatementResponse = z.object({ data: apiStatementSchema });
export const apiExpenseFileResponse = z.object({ data: z.object({ id, expense_id: id, stored_file_id: id }) });

export const apiPropertyPage = z.object({ data: z.array(z.object({ id, name: z.string(), archived_at: timestamp.nullable() })), meta: cursorMeta });
export const apiUnitPage = z.object({ data: z.array(z.object({ id, reference: z.string(), surface_hundredths: z.number().int().nullable() })), meta: cursorMeta });
export const apiTerms = z.object({
  data: z.array(
    z.object({
      id,
      key: z.string(),
      labels: z.record(z.string(), z.string()),
      semantic_key: z.string().nullable(),
      archived: z.boolean(),
      hidden: z.boolean(),
      metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    }),
  ),
});

export type ApiExpense = z.infer<typeof apiExpenseSchema>;
export type ApiKey = z.infer<typeof apiKeySchema>;
export type ApiStatementSummary = z.infer<typeof apiStatementSummarySchema>;
export type ApiExercise = z.infer<typeof apiExerciseSchema>;
export type ApiExerciseDetail = z.infer<typeof apiExerciseDetailSchema>;
export type ApiStatement = z.infer<typeof apiStatementSchema>;
export type ApiTerms = z.infer<typeof apiTerms>;
