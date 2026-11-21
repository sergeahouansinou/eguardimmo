import type { Currency } from '../../../format/money';

export interface Money {
  amount: number;
  currency: Currency;
}

export const LEDGER_ROLES = ['bank', 'trust_bank'] as const;
export const IDENTIFIER_KINDS = ['iban', 'other'] as const;
export const ACCOUNT_STATUSES = ['active', 'closed'] as const;
export const STATEMENT_SOURCES = ['camt053', 'mt940', 'cfonb120', 'csv', 'aggregator'] as const;
export const IMPORT_FORMATS = ['csv', 'camt053'] as const;
export const LINE_STATES = ['unmatched', 'matched', 'ignored'] as const;
export const DIRECTIONS = ['credit', 'debit'] as const;
export const CONFIDENCES = ['exact', 'strong', 'weak'] as const;
export const SUGGESTION_RULES = ['reference', 'existing_entry', 'known_counterparty', 'name', 'organization_rule', 'amount_only'] as const;
export const SUGGESTION_ACTIONS = ['match', 'settle_lease', 'settle_invoice', 'bank_charges', 'ignore'] as const;
export const SETTLE_ACTIONS = ['settle_lease', 'settle_invoice', 'bank_charges'] as const;
export const IGNORE_REASONS = ['out_of_scope', 'internal_transfer', 'bank_error', 'other'] as const;
export const MATCH_KINDS = ['suggested', 'manual', 'settled'] as const;
export const MATCH_SIDES = ['statement_line', 'journal_line'] as const;
export const RECONCILIATION_STATUSES = ['draft', 'validated', 'superseded'] as const;
export const BALANCE_SOURCES = ['statement', 'chained', 'entered'] as const;
export const CSV_DELIMITERS = [';', ',', '\t'] as const;
export const CSV_DATE_FORMATS = ['d/m/Y', 'Y-m-d', 'd-m-Y', 'd.m.Y'] as const;
export const CSV_ENCODINGS = ['UTF-8', 'Windows-1252'] as const;
export const CSV_COLUMN_KEYS = ['booking_date', 'value_date', 'label', 'amount', 'credit', 'debit', 'bank_reference', 'end_to_end_id', 'remittance_reference', 'counterparty_name', 'counterparty_iban', 'transaction_code'] as const;

export type LedgerRole = (typeof LEDGER_ROLES)[number];
export type IdentifierKind = (typeof IDENTIFIER_KINDS)[number];
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export type StatementSource = (typeof STATEMENT_SOURCES)[number];
export type ImportFormat = (typeof IMPORT_FORMATS)[number];
export type LineState = (typeof LINE_STATES)[number];
export type Direction = (typeof DIRECTIONS)[number];
export type Confidence = (typeof CONFIDENCES)[number];
export type SuggestionRule = (typeof SUGGESTION_RULES)[number];
export type SuggestionAction = (typeof SUGGESTION_ACTIONS)[number];
export type SettleAction = (typeof SETTLE_ACTIONS)[number];
export type IgnoreReason = (typeof IGNORE_REASONS)[number];
export type MatchKind = (typeof MATCH_KINDS)[number];
export type MatchSide = (typeof MATCH_SIDES)[number];
export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];
export type BalanceSource = (typeof BALANCE_SOURCES)[number];
export type CsvDelimiter = (typeof CSV_DELIMITERS)[number];
export type CsvDateFormat = (typeof CSV_DATE_FORMATS)[number];
export type CsvEncoding = (typeof CSV_ENCODINGS)[number];
export type CsvColumnKey = (typeof CSV_COLUMN_KEYS)[number];

export type CsvColumns = Partial<Record<CsvColumnKey, string | number>>;

export interface CsvProfile {
  delimiter: CsvDelimiter;
  encoding: CsvEncoding | null;
  hasHeader: boolean | null;
  dateFormat: CsvDateFormat;
  decimalSeparator: ',' | '.';
  thousandsSeparator: ' ' | '.' | ',' | '' | null;
  columns: CsvColumns;
}

export interface Page<Item> {
  items: Item[];
  nextCursor: string | null;
}

export interface BankAccount {
  id: string;
  ledgerRole: LedgerRole;
  label: string;
  bankName: string | null;
  holderName: string;
  identifierKind: IdentifierKind;
  last4: string;
  country: string | null;
  currency: Currency;
  status: AccountStatus;
  reconciliationFrom: string;
  openingBankBalance: Money;
  replacesId: string | null;
  csvProfile: CsvProfile | null;
  lastReconciledOn: string | null;
  closedAt: string | null;
  createdAt: string | null;
}

export interface BankStatement {
  id: string;
  bankAccountId: string;
  source: StatementSource;
  formatVersion: string | null;
  statementRef: string | null;
  sequence: string | null;
  periodFrom: string;
  periodTo: string;
  openingBalance: Money | null;
  closingBalance: Money | null;
  currency: Currency;
  linesTotal: number;
  linesImported: number;
  linesDuplicated: number;
  linesRejected: number;
  isCopy: boolean;
  voidedAt: string | null;
  voidReason: string | null;
  hasFile: boolean;
  createdAt: string | null;
}

export interface StatementGap {
  previousStatementId: string;
  statementId: string;
  expectedOpening: number;
  actualOpening: number;
}

export interface StatementDetail {
  statement: BankStatement;
  gaps: StatementGap[];
}

export interface RejectedLine {
  line: number;
  code: string;
}

export interface ImportResult {
  statement: BankStatement;
  rejected: RejectedLine[];
}

export interface PreviewLine {
  number: number;
  bookingDate: string;
  valueDate: string | null;
  direction: Direction;
  amount: Money;
  label: string;
  bankReference: string | null;
}

export interface StatementPreview {
  source: StatementSource;
  formatVersion: string | null;
  statementRef: string | null;
  periodFrom: string;
  periodTo: string;
  isCopy: boolean;
  currency: Currency;
  linesTotal: number;
  wouldImport: number;
  wouldDuplicate: number;
  alreadyImported: boolean;
  rejected: RejectedLine[];
  lines: PreviewLine[];
}

export interface SuggestionTarget {
  type: 'journal_line' | 'lease' | 'invoice';
  id: string;
  amount: number;
}

export interface Suggestion {
  id: string;
  statementLineId: string;
  rule: SuggestionRule;
  confidence: Confidence;
  preselected: boolean;
  score: number;
  action: SuggestionAction;
  targets: SuggestionTarget[];
  codes: string[];
  computedAt: string;
}

export interface BankLine {
  id: string;
  statementId: string;
  bankAccountId: string;
  bookingDate: string;
  valueDate: string | null;
  direction: Direction;
  amount: Money;
  signedAmount: Money;
  reversal: boolean;
  bankReference: string | null;
  transactionCode: string | null;
  label: string;
  remittanceReference: string | null;
  counterpartyName: string | null;
  counterpartyLast4: string | null;
  state: LineState;
  ignoreReason: IgnoreReason | null;
  lockVersion: number;
  matchId: string | null;
  suggestion: Suggestion | null;
}

export interface BookLine {
  lineId: string;
  entryId: string;
  entryReference: string | null;
  entryDate: string;
  entryLabel: string | null;
  side: Direction;
  amount: Money;
  isReversal: boolean;
  isReversed: boolean;
}

export interface MatchItem {
  side: MatchSide;
  refId: string;
  amount: Money;
}

export interface BankMatch {
  id: string;
  bankAccountId: string;
  kind: MatchKind;
  confidence: Confidence | null;
  undoneAt: string | null;
  items: MatchItem[];
}

export interface AcceptResult {
  accepted: { suggestionId: string; matchId: string | null }[];
  skipped: { suggestionId: string; reason: string }[];
  replayed: boolean;
}

export interface ReconciliationLineItem {
  id: string;
  direction: Direction;
  amount: number;
}

export interface Reconciliation {
  id: string;
  bankAccountId: string;
  asOf: string;
  currency: Currency;
  status: ReconciliationStatus;
  balanceSource: BalanceSource;
  bankBalance: Money;
  hasBalanceProof: boolean;
  bookBalance: Money;
  unmatchedLinesTotal: Money;
  unmatchedEntriesTotal: Money;
  ignoredTotal: Money;
  timingDifference: Money;
  unexplainedDifference: Money;
  hasGap: boolean;
  validatable: boolean;
  unmatchedLines: ReconciliationLineItem[];
  ignoredLines: ReconciliationLineItem[];
  unmatchedEntryCount: number;
  gaps: StatementGap[];
  truncated: boolean;
  validatedAt: string | null;
  supersedesId: string | null;
  createdAt: string | null;
}

export interface AccountInput {
  ledgerRole: LedgerRole;
  label: string;
  bankName: string;
  holderName: string;
  identifierKind: IdentifierKind;
  identifier: string;
  country: string;
  reconciliationFrom: string;
  openingBankBalance: number;
  csvProfile: CsvProfile | null;
}

export interface LineQuery {
  accountId: string;
  state: LineState;
  cursor: string | null;
  direction?: Direction | null;
  amount?: number | null;
  from?: string | null;
  to?: string | null;
}

export interface BookLineQuery {
  accountId: string;
  side: Direction | null;
  amount: number | null;
  from: string | null;
  to: string | null;
  cursor: string | null;
}

export interface LeaseAllocation {
  leaseId: string;
  amount: number;
}

export type SettleInput =
  | { action: 'settle_lease'; allocations: readonly LeaseAllocation[] }
  | { action: 'settle_invoice'; invoiceId: string; amount: number | null }
  | { action: 'bank_charges' };

export interface BuildReconciliationInput {
  accountId: string;
  month: string;
  bankBalance: number | null;
  proof: File | null;
}

export interface BankingPermissions {
  available: boolean;
  manageAccounts: boolean;
}
