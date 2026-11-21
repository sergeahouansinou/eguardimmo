import type { ApiAccount, ApiBookLine, ApiGap, ApiLine, ApiMatch, ApiPreview, ApiReconciliation, ApiStatement, ApiSuggestion } from './bankingSchemas';
import type { BankAccount, BankLine, BankMatch, BankStatement, BookLine, CsvColumns, CsvProfile, Reconciliation, StatementGap, StatementPreview, Suggestion } from '../model';
import { CSV_COLUMN_KEYS } from '../model';

function toColumns(columns: Record<string, string | number | null | undefined>): CsvColumns {
  const result: CsvColumns = {};
  for (const key of CSV_COLUMN_KEYS) {
    const value = columns[key];
    if (value !== null && value !== undefined) result[key] = value;
  }
  return result;
}

export const toProfile = (api: NonNullable<ApiAccount['csv_profile']>): CsvProfile => ({
  delimiter: api.delimiter,
  encoding: api.encoding ?? null,
  hasHeader: api.has_header ?? null,
  dateFormat: api.date_format,
  decimalSeparator: api.decimal_separator,
  thousandsSeparator: api.thousands_separator ?? null,
  columns: toColumns(api.columns),
});

export const toAccount = (api: ApiAccount): BankAccount => ({
  id: api.id,
  ledgerRole: api.ledger_role,
  label: api.label,
  bankName: api.bank_name,
  holderName: api.holder_name,
  identifierKind: api.identifier_kind,
  last4: api.last4,
  country: api.country,
  currency: api.currency,
  status: api.status,
  reconciliationFrom: api.reconciliation_from,
  openingBankBalance: api.opening_bank_balance,
  replacesId: api.replaces_id,
  csvProfile: api.csv_profile === null ? null : toProfile(api.csv_profile),
  lastReconciledOn: api.last_reconciled_on,
  closedAt: api.closed_at,
  createdAt: api.created_at,
});

export const toStatement = (api: ApiStatement): BankStatement => ({
  id: api.id,
  bankAccountId: api.bank_account_id,
  source: api.source,
  formatVersion: api.format_version,
  statementRef: api.statement_ref,
  sequence: api.sequence,
  periodFrom: api.period_from,
  periodTo: api.period_to,
  openingBalance: api.opening_balance,
  closingBalance: api.closing_balance,
  currency: api.currency,
  linesTotal: api.lines_total,
  linesImported: api.lines_imported,
  linesDuplicated: api.lines_duplicated,
  linesRejected: api.lines_rejected,
  isCopy: api.is_copy,
  voidedAt: api.voided_at,
  voidReason: api.void_reason,
  hasFile: api.has_file,
  createdAt: api.created_at,
});

export const toGap = (api: ApiGap): StatementGap => ({
  previousStatementId: api.previous_statement_id,
  statementId: api.statement_id,
  expectedOpening: api.expected_opening,
  actualOpening: api.actual_opening,
});

export const toSuggestion = (api: ApiSuggestion): Suggestion => ({
  id: api.id,
  statementLineId: api.statement_line_id,
  rule: api.rule,
  confidence: api.confidence,
  preselected: api.preselected,
  score: api.score,
  action: api.action,
  targets: api.targets,
  codes: api.explanation.codes,
  computedAt: api.computed_at,
});

export const toLine = (api: ApiLine): BankLine => ({
  id: api.id,
  statementId: api.statement_id,
  bankAccountId: api.bank_account_id,
  bookingDate: api.booking_date,
  valueDate: api.value_date,
  direction: api.direction,
  amount: api.amount,
  signedAmount: api.signed_amount,
  reversal: api.reversal,
  bankReference: api.bank_reference,
  transactionCode: api.transaction_code,
  label: api.label,
  remittanceReference: api.remittance_reference,
  counterpartyName: api.counterparty_name,
  counterpartyLast4: api.counterparty_last4,
  state: api.state,
  ignoreReason: api.ignore_reason,
  lockVersion: api.lock_version,
  matchId: api.match_id,
  suggestion: api.suggestion === null ? null : toSuggestion(api.suggestion),
});

export const toBookLine = (api: ApiBookLine): BookLine => ({
  lineId: api.line_id,
  entryId: api.entry_id,
  entryReference: api.entry_reference,
  entryDate: api.entry_date,
  entryLabel: api.entry_label,
  side: api.side,
  amount: api.amount,
  isReversal: api.is_reversal,
  isReversed: api.is_reversed,
});

export const toMatch = (api: ApiMatch): BankMatch => ({
  id: api.id,
  bankAccountId: api.bank_account_id,
  kind: api.kind,
  confidence: api.confidence,
  undoneAt: api.undone_at,
  items: api.items.map((item) => ({ side: item.side, refId: item.ref_id, amount: item.amount })),
});

export const toReconciliation = (api: ApiReconciliation): Reconciliation => ({
  id: api.id,
  bankAccountId: api.bank_account_id,
  asOf: api.as_of,
  currency: api.currency,
  status: api.status,
  balanceSource: api.bank_balance_source,
  bankBalance: api.bank_balance,
  hasBalanceProof: api.has_balance_proof,
  bookBalance: api.book_balance,
  unmatchedLinesTotal: api.unmatched_lines_total,
  unmatchedEntriesTotal: api.unmatched_entries_total,
  ignoredTotal: api.ignored_total,
  timingDifference: api.timing_difference,
  unexplainedDifference: api.unexplained_difference,
  hasGap: api.has_gap,
  validatable: api.validatable,
  unmatchedLines: api.items.unmatched_lines,
  ignoredLines: api.items.ignored_lines,
  unmatchedEntryCount: api.items.unmatched_entries.length,
  gaps: api.items.gaps.map(toGap),
  truncated: api.items.truncated,
  validatedAt: api.validated_at,
  supersedesId: api.supersedes_id,
  createdAt: api.created_at,
});

export const toPreview = (api: ApiPreview): StatementPreview => ({
  source: api.source,
  formatVersion: api.format_version,
  statementRef: api.statement_ref,
  periodFrom: api.period_from,
  periodTo: api.period_to,
  isCopy: api.is_copy,
  currency: api.currency,
  linesTotal: api.lines_total,
  wouldImport: api.would_import,
  wouldDuplicate: api.would_duplicate,
  alreadyImported: api.already_imported,
  rejected: api.rejected,
  lines: api.lines.map((line) => ({
    number: line.number,
    bookingDate: line.booking_date,
    valueDate: line.value_date,
    direction: line.direction,
    amount: line.amount,
    label: line.label,
    bankReference: line.bank_reference,
  })),
});
