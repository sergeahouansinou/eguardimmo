import { z } from 'zod';
import { CURRENCIES } from '../../../../format/money';
import {
  ACCOUNT_STATUSES,
  BALANCE_SOURCES,
  CONFIDENCES,
  CSV_DATE_FORMATS,
  CSV_DELIMITERS,
  CSV_ENCODINGS,
  DIRECTIONS,
  IDENTIFIER_KINDS,
  IGNORE_REASONS,
  LEDGER_ROLES,
  LINE_STATES,
  MATCH_KINDS,
  MATCH_SIDES,
  RECONCILIATION_STATUSES,
  STATEMENT_SOURCES,
  SUGGESTION_ACTIONS,
  SUGGESTION_RULES,
} from '../model';

const id = z.guid();
const timestamp = z.iso.datetime({ offset: true });
const isoDate = z.iso.date();
const count = z.number().int().nonnegative();
const money = z.object({ amount: z.number().int(), currency: z.enum(CURRENCIES) });
const cursorMeta = z.object({ next_cursor: z.string().nullable() });
const column = z.union([z.number().int(), z.string()]);

const csvProfileSchema = z.object({
  delimiter: z.enum(CSV_DELIMITERS),
  encoding: z.enum(CSV_ENCODINGS).nullish(),
  has_header: z.boolean().nullish(),
  date_format: z.enum(CSV_DATE_FORMATS),
  decimal_separator: z.enum([',', '.']),
  thousands_separator: z.enum([' ', '.', ',', '']).nullish(),
  columns: z.record(z.string(), column.nullish()),
});

export const apiAccountSchema = z.object({
  id,
  ledger_role: z.enum(LEDGER_ROLES),
  label: z.string(),
  bank_name: z.string().nullable(),
  holder_name: z.string(),
  identifier_kind: z.enum(IDENTIFIER_KINDS),
  last4: z.string(),
  country: z.string().nullable(),
  currency: z.enum(CURRENCIES),
  status: z.enum(ACCOUNT_STATUSES),
  reconciliation_from: isoDate,
  opening_bank_balance: money,
  replaces_id: id.nullable(),
  csv_profile: csvProfileSchema.nullable(),
  last_reconciled_on: isoDate.nullable(),
  closed_at: timestamp.nullable(),
  created_at: timestamp.nullable(),
});

export const apiStatementSchema = z.object({
  id,
  bank_account_id: id,
  source: z.enum(STATEMENT_SOURCES),
  format_version: z.string().nullable(),
  statement_ref: z.string().nullable(),
  sequence: z.string().nullable(),
  period_from: isoDate,
  period_to: isoDate,
  opening_balance: money.nullable(),
  closing_balance: money.nullable(),
  currency: z.enum(CURRENCIES),
  lines_total: count,
  lines_imported: count,
  lines_duplicated: count,
  lines_rejected: count,
  is_copy: z.boolean(),
  imported_by_user_id: id.nullable(),
  voided_at: timestamp.nullable(),
  void_reason: z.string().nullable(),
  has_file: z.boolean(),
  created_at: timestamp.nullable(),
});

const gapSchema = z.object({ previous_statement_id: id, statement_id: id, expected_opening: z.number().int(), actual_opening: z.number().int() });
const rejectedSchema = z.object({ line: z.number().int().positive(), code: z.string() });

const explanationSchema = z.object({ codes: z.array(z.string()), ids: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]) });

export const apiSuggestionSchema = z.object({
  id,
  statement_line_id: id,
  rule: z.enum(SUGGESTION_RULES),
  confidence: z.enum(CONFIDENCES),
  preselected: z.boolean(),
  score: count,
  action: z.enum(SUGGESTION_ACTIONS),
  targets: z.array(z.object({ type: z.enum(['journal_line', 'lease', 'invoice']), id, amount: z.number().int() })),
  explanation: explanationSchema,
  computed_at: timestamp,
});

export const apiLineSchema = z.object({
  id,
  statement_id: id,
  bank_account_id: id,
  booking_date: isoDate,
  value_date: isoDate.nullable(),
  direction: z.enum(DIRECTIONS),
  amount: money,
  signed_amount: money,
  original_amount: money.nullable(),
  reversal: z.boolean(),
  bank_reference: z.string().nullable(),
  end_to_end_id: z.string().nullable(),
  transaction_code: z.string().nullable(),
  label: z.string(),
  remittance_reference: z.string().nullable(),
  counterparty_name: z.string().nullable(),
  counterparty_last4: z.string().nullable(),
  state: z.enum(LINE_STATES),
  ignore_reason: z.enum(IGNORE_REASONS).nullable(),
  lock_version: z.number().int().positive(),
  match_id: id.nullable(),
  suggestion: apiSuggestionSchema.nullable(),
});

export const apiBookLineSchema = z.object({
  line_id: id,
  entry_id: id,
  entry_reference: z.string().nullable(),
  entry_date: z.string(),
  entry_label: z.string().nullable(),
  journal: z.string(),
  side: z.enum(DIRECTIONS),
  amount: money,
  source_type: z.string(),
  source_id: z.string().nullable(),
  is_reversal: z.boolean(),
  is_reversed: z.boolean(),
});

export const apiMatchSchema = z.object({
  id,
  bank_account_id: id,
  kind: z.enum(MATCH_KINDS),
  rule: z.enum(SUGGESTION_RULES).nullable(),
  confidence: z.enum(CONFIDENCES).nullable(),
  explanation: explanationSchema.nullable(),
  matched_by_user_id: id.nullable(),
  undone_at: timestamp.nullable(),
  undo_reason: z.string().nullable(),
  created_at: timestamp.nullable(),
  items: z.array(z.object({ side: z.enum(MATCH_SIDES), ref_id: id, amount: money })),
});

const itemLine = z.object({ id, direction: z.enum(DIRECTIONS), amount: z.number().int() });

export const apiReconciliationSchema = z.object({
  id,
  bank_account_id: id,
  as_of: isoDate,
  currency: z.enum(CURRENCIES),
  status: z.enum(RECONCILIATION_STATUSES),
  bank_balance_source: z.enum(BALANCE_SOURCES),
  bank_balance: money,
  has_balance_proof: z.boolean(),
  book_balance: money,
  unmatched_lines_total: money,
  unmatched_entries_total: money,
  ignored_total: money,
  timing_difference: money,
  unexplained_difference: money,
  has_gap: z.boolean(),
  validatable: z.boolean(),
  items: z.object({
    unmatched_lines: z.array(itemLine),
    ignored_lines: z.array(itemLine),
    unmatched_entries: z.array(z.object({ id, side: z.enum(DIRECTIONS), amount: z.number().int() })),
    gaps: z.array(gapSchema),
    truncated: z.boolean(),
  }),
  validated_by_user_id: id.nullable(),
  validated_at: timestamp.nullable(),
  supersedes_id: id.nullable(),
  created_at: timestamp.nullable(),
});

export const apiPreviewSchema = z.object({
  source: z.enum(STATEMENT_SOURCES),
  format_version: z.string().nullable(),
  statement_ref: z.string().nullable(),
  period_from: isoDate,
  period_to: isoDate,
  is_copy: z.boolean(),
  currency: z.enum(CURRENCIES),
  lines_total: count,
  would_import: count,
  would_duplicate: count,
  already_imported: z.boolean(),
  rejected: z.array(rejectedSchema),
  lines: z.array(
    z.object({
      number: z.number().int().positive(),
      booking_date: isoDate,
      value_date: isoDate.nullable(),
      direction: z.enum(DIRECTIONS),
      amount: money,
      label: z.string(),
      bank_reference: z.string().nullable(),
    }),
  ),
});

export const apiAccountList = z.object({ data: z.array(apiAccountSchema) });
export const apiAccountResponse = z.object({ data: apiAccountSchema });
export const apiStatementPage = z.object({ data: z.array(apiStatementSchema), meta: cursorMeta });
export const apiStatementShow = z.object({ data: apiStatementSchema, meta: z.object({ gaps: z.array(gapSchema) }) });
export const apiImportResponse = z.object({ data: apiStatementSchema, meta: z.object({ rejected: z.array(rejectedSchema) }) });
export const apiPreviewResponse = z.object({ data: apiPreviewSchema });
export const apiLinePage = z.object({ data: z.array(apiLineSchema), meta: cursorMeta });
export const apiLineResponse = z.object({ data: apiLineSchema });
export const apiBookLinePage = z.object({ data: z.array(apiBookLineSchema), meta: cursorMeta });
export const apiMatchResponse = z.object({ data: apiMatchSchema });
export const apiAcceptResponse = z.object({
  data: z.object({
    accepted: z.array(z.object({ suggestion_id: id, match_id: id.nullable() })),
    skipped: z.array(z.object({ suggestion_id: id, reason: z.string() })),
    replayed: z.boolean(),
  }),
});
export const apiReconciliationPage = z.object({ data: z.array(apiReconciliationSchema), meta: cursorMeta });
export const apiReconciliationResponse = z.object({ data: apiReconciliationSchema });
export const apiAccountingBalances = z.object({ data: z.array(z.object({ balances: z.array(money) })) });

export type ApiAccount = z.infer<typeof apiAccountSchema>;
export type ApiStatement = z.infer<typeof apiStatementSchema>;
export type ApiLine = z.infer<typeof apiLineSchema>;
export type ApiSuggestion = z.infer<typeof apiSuggestionSchema>;
export type ApiBookLine = z.infer<typeof apiBookLineSchema>;
export type ApiMatch = z.infer<typeof apiMatchSchema>;
export type ApiReconciliation = z.infer<typeof apiReconciliationSchema>;
export type ApiPreview = z.infer<typeof apiPreviewSchema>;
export type ApiGap = z.infer<typeof gapSchema>;
