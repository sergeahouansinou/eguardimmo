'use client';

import type { ConfirmProof } from '../../reauth/proof';
import { MissingSourceError, createSourceContext } from '../../locataires/kit/sourceContext';
import type { Currency } from '../../../format/money';
import type {
  ChargeKey,
  ChargesPermissions,
  Exercise,
  ExerciseDetail,
  ExerciseInput,
  ExerciseQuery,
  Expense,
  ExpenseExportQuery,
  ExpenseInput,
  ExpenseQuery,
  ItemInput,
  KeyInput,
  Page,
  PlanInput,
  PropertyChoice,
  Statement,
  Term,
  UnitChoice,
} from './model';

export interface ChargesSource {
  readonly permissions: ChargesPermissions;
  expenses: (query: ExpenseQuery) => Promise<Page<Expense>>;
  expense: (id: string) => Promise<Expense>;
  recordExpense: (input: ExpenseInput, key: string) => Promise<Expense>;
  cancelExpense: (id: string, reason: string) => Promise<Expense>;
  approveExpense: (id: string) => Promise<Expense>;
  attachExpenseFile: (id: string, file: File) => Promise<void>;
  downloadExpenseFile: (id: string, fileId: string) => Promise<Blob>;
  exportExpenses: (query: ExpenseExportQuery) => Promise<Blob>;
  keys: (propertyId: string) => Promise<ChargeKey[]>;
  createKey: (propertyId: string, input: KeyInput) => Promise<ChargeKey>;
  addKeyVersion: (propertyId: string, keyId: string, validFrom: string, shares: KeyInput['shares']) => Promise<ChargeKey>;
  archiveKey: (propertyId: string, keyId: string) => Promise<ChargeKey>;
  exercises: (query: ExerciseQuery) => Promise<Page<Exercise>>;
  exercise: (id: string) => Promise<ExerciseDetail>;
  createExercise: (input: ExerciseInput) => Promise<ExerciseDetail>;
  updateExercise: (id: string, lockVersion: number, items: readonly ItemInput[]) => Promise<ExerciseDetail>;
  computeExercise: (id: string) => Promise<ExerciseDetail>;
  discardExercise: (id: string) => Promise<Exercise>;
  issueExercise: (id: string, key: string, acknowledgePrescription: boolean) => Promise<ExerciseDetail>;
  exportStatements: (exerciseId: string) => Promise<Blob>;
  statement: (id: string) => Promise<Statement>;
  downloadStatementPdf: (id: string) => Promise<Blob>;
  retryStatement: (id: string, key: string) => Promise<Statement>;
  rectifyStatement: (id: string, reason: string, key: string) => Promise<ExerciseDetail>;
  recordPlan: (id: string, input: PlanInput, key: string) => Promise<Statement>;
  shareStatementFile: (statementId: string, fileId: string, visible: boolean) => Promise<Statement>;
  properties: () => Promise<PropertyChoice[]>;
  units: (propertyId: string) => Promise<UnitChoice[]>;
  terms: (vocabulary: 'expense_category' | 'charge_rubric') => Promise<Term[]>;
  currency: () => Promise<Currency>;
  confirmTwoFactor: ConfirmProof;
}

const context = createSourceContext<ChargesSource>('Charges', () => {
  throw new MissingSourceError('Charges');
});

export const ChargesSourceProvider = context.SourceProvider;
export const useChargesSource = context.useSource;
