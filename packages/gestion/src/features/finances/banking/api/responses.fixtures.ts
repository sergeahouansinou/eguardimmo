export const IDS = {
  org: '01934f6e-0000-7000-8000-00000000000b',
  user: '01934f6e-0000-7000-8000-0000000000a0',
  account: '01934f6e-0000-7000-8000-0000000000a1',
  accountTrust: '01934f6e-0000-7000-8000-0000000000a2',
  statement: '01934f6e-0000-7000-8000-0000000000b1',
  statementPrev: '01934f6e-0000-7000-8000-0000000000b2',
  lineA: '01934f6e-0000-7000-8000-0000000000c1',
  lineB: '01934f6e-0000-7000-8000-0000000000c2',
  lineC: '01934f6e-0000-7000-8000-0000000000c3',
  lineD: '01934f6e-0000-7000-8000-0000000000c4',
  lineE: '01934f6e-0000-7000-8000-0000000000c5',
  suggestionA: '01934f6e-0000-7000-8000-0000000000d1',
  suggestionB: '01934f6e-0000-7000-8000-0000000000d2',
  suggestionWeak: '01934f6e-0000-7000-8000-0000000000d3',
  match: '01934f6e-0000-7000-8000-0000000000e1',
  lease: '01934f6e-0000-7000-8000-0000000000f1',
  leaseB: '01934f6e-0000-7000-8000-0000000000f2',
  invoice: '01934f6e-0000-7000-8000-000000000101',
  entry: '01934f6e-0000-7000-8000-000000000111',
  bookLine: '01934f6e-0000-7000-8000-000000000121',
  bookLineB: '01934f6e-0000-7000-8000-000000000122',
  reconciliation: '01934f6e-0000-7000-8000-000000000131',
  reconciliationValidated: '01934f6e-0000-7000-8000-000000000132',
} as const;

export const eur = (amount: number) => ({ amount, currency: 'EUR' as const });
export const xof = (amount: number) => ({ amount, currency: 'XOF' as const });

export const csvProfile = {
  delimiter: ';',
  encoding: 'UTF-8',
  has_header: true,
  date_format: 'd/m/Y',
  decimal_separator: ',',
  columns: { booking_date: 1, label: 2, amount: 3 },
};

export const account = {
  id: IDS.account,
  ledger_role: 'bank',
  label: 'Compte courant agence',
  bank_name: 'Banque Populaire',
  holder_name: 'Agence Dupont Immobilier',
  identifier_kind: 'iban',
  last4: '0189',
  country: 'FR',
  currency: 'EUR',
  status: 'active',
  reconciliation_from: '2026-01-01',
  opening_bank_balance: eur(1250050),
  replaces_id: null,
  csv_profile: csvProfile,
  last_reconciled_on: '2026-02-28',
  closed_at: null,
  created_at: '2026-01-02T09:00:00+00:00',
};

export const accountTrust = { ...account, id: IDS.accountTrust, ledger_role: 'trust_bank', label: 'Compte de tiers mandants', last4: '4521', csv_profile: null, last_reconciled_on: null };
export const accountClosed = { ...account, id: IDS.accountTrust, status: 'closed', label: 'Ancien compte', last4: '7788', closed_at: '2026-03-01T10:00:00+00:00' };

export const statement = {
  id: IDS.statement,
  bank_account_id: IDS.account,
  source: 'csv',
  format_version: null,
  statement_ref: null,
  sequence: null,
  period_from: '2026-03-01',
  period_to: '2026-03-31',
  opening_balance: eur(1250050),
  closing_balance: eur(1480050),
  currency: 'EUR',
  lines_total: 5,
  lines_imported: 5,
  lines_duplicated: 0,
  lines_rejected: 0,
  is_copy: false,
  imported_by_user_id: IDS.user,
  voided_at: null,
  void_reason: null,
  has_file: true,
  created_at: '2026-04-02T08:00:00+00:00',
};

export const statementVoided = { ...statement, id: IDS.statementPrev, period_from: '2026-02-01', period_to: '2026-02-28', voided_at: '2026-04-03T08:00:00+00:00', void_reason: 'Mauvais compte sélectionné' };

export const gap = { previous_statement_id: IDS.statementPrev, statement_id: IDS.statement, expected_opening: 1250050, actual_opening: 1200000 };

export const suggestionExact = {
  id: IDS.suggestionA,
  statement_line_id: IDS.lineA,
  rule: 'reference',
  confidence: 'exact',
  preselected: true,
  score: 100,
  action: 'settle_lease',
  targets: [{ type: 'lease', id: IDS.lease, amount: 85000 }],
  explanation: { codes: ['notice_number_in_remittance', 'amount_equals_outstanding'], ids: { lease: IDS.lease } },
  computed_at: '2026-04-02T08:00:05+00:00',
};

export const suggestionStrong = { ...suggestionExact, id: IDS.suggestionB, statement_line_id: IDS.lineB, rule: 'name', confidence: 'strong', score: 80, explanation: { codes: ['tenant_name_in_label'], ids: [] } };
export const suggestionWeak = { ...suggestionExact, id: IDS.suggestionWeak, statement_line_id: IDS.lineC, rule: 'amount_only', confidence: 'weak', preselected: false, score: 30, action: 'match', targets: [{ type: 'journal_line', id: IDS.bookLine, amount: 4200 }], explanation: { codes: ['amount_equals_entry', 'ambiguous'], ids: [] } };

const lineBase = {
  statement_id: IDS.statement,
  bank_account_id: IDS.account,
  value_date: null,
  original_amount: null,
  reversal: false,
  bank_reference: null,
  end_to_end_id: null,
  transaction_code: null,
  remittance_reference: null,
  counterparty_name: null,
  counterparty_last4: null,
  state: 'unmatched',
  ignore_reason: null,
  lock_version: 1,
  match_id: null,
  suggestion: null,
};

export const lineLoyer = { ...lineBase, id: IDS.lineA, booking_date: '2026-03-05', direction: 'credit', amount: eur(85000), signed_amount: eur(85000), label: 'VIR LOYER MARS MARTIN', counterparty_name: 'Julie Martin', counterparty_last4: '3321', suggestion: suggestionExact };
export const lineNom = { ...lineBase, id: IDS.lineB, booking_date: '2026-03-06', direction: 'credit', amount: eur(62000), signed_amount: eur(62000), label: 'VIR DUPUIS', suggestion: suggestionStrong };
export const lineFaible = { ...lineBase, id: IDS.lineC, booking_date: '2026-03-09', direction: 'debit', amount: eur(4200), signed_amount: eur(-4200), label: 'PRLV ASSURANCE', suggestion: suggestionWeak };
export const lineFrais = { ...lineBase, id: IDS.lineD, booking_date: '2026-03-12', direction: 'debit', amount: eur(1500), signed_amount: eur(-1500), label: 'FRAIS TENUE DE COMPTE' };
export const lineMatched = { ...lineBase, id: IDS.lineE, booking_date: '2026-03-15', direction: 'credit', amount: eur(90000), signed_amount: eur(90000), label: 'VIR LOYER ROUX', state: 'matched', lock_version: 2, match_id: IDS.match };
export const lineIgnored = { ...lineBase, id: IDS.lineE, booking_date: '2026-03-16', direction: 'debit', amount: eur(500), signed_amount: eur(-500), label: 'VIREMENT INTERNE', state: 'ignored', ignore_reason: 'internal_transfer', lock_version: 3 };

export const bookLine = {
  line_id: IDS.bookLine,
  entry_id: IDS.entry,
  entry_reference: 'ENC-2026-031',
  entry_date: '2026-03-10',
  entry_label: 'Loyer mars Dupuis',
  journal: 'bank',
  side: 'debit',
  amount: eur(62000),
  source_type: 'rent_payment',
  source_id: IDS.lease,
  is_reversal: false,
  is_reversed: false,
};

export const match = {
  id: IDS.match,
  bank_account_id: IDS.account,
  kind: 'settled',
  rule: null,
  confidence: null,
  explanation: null,
  matched_by_user_id: IDS.user,
  undone_at: null,
  undo_reason: null,
  created_at: '2026-04-05T10:00:00+00:00',
  items: [{ side: 'statement_line', ref_id: IDS.lineA, amount: eur(85000) }],
};

export const reconciliation = {
  id: IDS.reconciliation,
  bank_account_id: IDS.account,
  as_of: '2026-03-31',
  currency: 'EUR',
  status: 'draft',
  bank_balance_source: 'statement',
  bank_balance: eur(1480050),
  has_balance_proof: false,
  book_balance: eur(1480050),
  unmatched_lines_total: eur(0),
  unmatched_entries_total: eur(0),
  ignored_total: eur(0),
  timing_difference: eur(0),
  unexplained_difference: eur(0),
  has_gap: false,
  validatable: true,
  items: { unmatched_lines: [], ignored_lines: [], unmatched_entries: [], gaps: [], truncated: false },
  validated_by_user_id: null,
  validated_at: null,
  supersedes_id: null,
  created_at: '2026-04-06T09:00:00+00:00',
};

export const reconciliationGap = {
  ...reconciliation,
  id: IDS.reconciliationValidated,
  unexplained_difference: eur(-4200),
  has_gap: true,
  validatable: false,
  items: { unmatched_lines: [{ id: IDS.lineC, direction: 'debit', amount: 4200 }], ignored_lines: [], unmatched_entries: [], gaps: [gap], truncated: false },
};

export const reconciliationValidated = { ...reconciliation, id: IDS.reconciliationValidated, status: 'validated', has_balance_proof: true, bank_balance_source: 'entered', validatable: false, validated_by_user_id: IDS.user, validated_at: '2026-04-07T09:00:00+00:00' };

export const preview = {
  source: 'csv',
  format_version: null,
  statement_ref: null,
  period_from: '2026-03-01',
  period_to: '2026-03-31',
  is_copy: false,
  currency: 'EUR',
  lines_total: 3,
  would_import: 2,
  would_duplicate: 0,
  already_imported: false,
  rejected: [{ line: 3, code: 'date_invalid' }],
  lines: [
    { number: 1, booking_date: '2026-03-05', value_date: null, direction: 'credit', amount: eur(85000), label: 'VIR LOYER MARS MARTIN', bank_reference: null },
    { number: 2, booking_date: '2026-03-06', value_date: null, direction: 'debit', amount: eur(1500), label: 'FRAIS TENUE DE COMPTE', bank_reference: null },
  ],
};

export const accountingBalances = { data: [{ balances: [eur(0)] }] };
