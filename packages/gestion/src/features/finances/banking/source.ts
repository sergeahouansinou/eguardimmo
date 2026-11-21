'use client';

import type { Currency } from '../../../format/money';
import { MissingSourceError, createSourceContext } from '../../locataires/kit/sourceContext';
import type { ConfirmProof } from '../../reauth/proof';
import type {
  AcceptResult,
  AccountInput,
  BankAccount,
  BankLine,
  BankMatch,
  BankStatement,
  BankingPermissions,
  BookLine,
  BookLineQuery,
  BuildReconciliationInput,
  CsvProfile,
  IgnoreReason,
  ImportFormat,
  ImportResult,
  LineQuery,
  Page,
  Reconciliation,
  SettleInput,
  StatementDetail,
  StatementPreview,
} from './model';

export interface BankingSource {
  readonly permissions: BankingPermissions;
  accounts: () => Promise<BankAccount[]>;
  createAccount: (input: AccountInput, key: string) => Promise<BankAccount>;
  replaceAccount: (id: string, input: AccountInput, key: string) => Promise<BankAccount>;
  updateAccount: (id: string, label: string, profile: CsvProfile | null) => Promise<BankAccount>;
  closeAccount: (id: string) => Promise<BankAccount>;
  statements: (accountId: string | null, cursor: string | null) => Promise<Page<BankStatement>>;
  statement: (id: string) => Promise<StatementDetail>;
  previewStatement: (accountId: string, file: File, format: ImportFormat, profile: CsvProfile | null) => Promise<StatementPreview>;
  importStatement: (accountId: string, file: File, format: ImportFormat, profile: CsvProfile | null, key: string) => Promise<ImportResult>;
  voidStatement: (id: string, reason: string) => Promise<BankStatement>;
  downloadStatement: (id: string) => Promise<Blob>;
  lines: (query: LineQuery) => Promise<Page<BankLine>>;
  bookLines: (query: BookLineQuery) => Promise<Page<BookLine>>;
  matchLine: (lineId: string, otherLineIds: readonly string[], journalLineIds: readonly string[], lockVersion: number, key: string) => Promise<BankMatch>;
  settleLine: (lineId: string, input: SettleInput, lockVersion: number, key: string) => Promise<BankMatch>;
  ignoreLine: (lineId: string, reason: IgnoreReason, pairLineId: string | null, lockVersion: number) => Promise<BankLine>;
  restoreLine: (lineId: string, lockVersion: number) => Promise<BankLine>;
  acceptSuggestions: (suggestionIds: readonly string[], key: string) => Promise<AcceptResult>;
  undoMatch: (matchId: string, reason: string) => Promise<BankMatch>;
  reconciliations: (accountId: string | null, cursor: string | null) => Promise<Page<Reconciliation>>;
  reconciliation: (id: string) => Promise<Reconciliation>;
  buildReconciliation: (input: BuildReconciliationInput, key: string) => Promise<Reconciliation>;
  validateReconciliation: (id: string, key: string) => Promise<Reconciliation>;
  downloadProof: (id: string) => Promise<Blob>;
  currency: () => Promise<Currency | null>;
  confirmTwoFactor: ConfirmProof;
}

const context = createSourceContext<BankingSource>('Banking', () => {
  throw new MissingSourceError('Banking');
});

export const BankingSourceProvider = context.SourceProvider;
export const useBankingSource = context.useSource;
