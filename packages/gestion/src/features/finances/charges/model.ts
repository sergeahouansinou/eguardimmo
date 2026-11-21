import type { Currency } from '../../../format/money';

export interface Money {
  amount: number;
  currency: Currency;
}

export const EXPENSE_KINDS = ['payment', 'co_ownership_statement'] as const;
export const EXPENSE_SETTLEMENTS = ['bank', 'cash', 'trust', 'own_funds_advance', 'paid_by_owner', 'none'] as const;
export const EXPENSE_STATUSES = ['pending_approval', 'recorded', 'cancelled'] as const;
export const EXERCISE_STATUSES = ['draft', 'computed', 'issuing', 'issued', 'discarded'] as const;
export const STATEMENT_STATUSES = ['computed', 'issued', 'failed', 'superseded'] as const;
export const STATEMENT_SETTLEMENTS = ['next_installments', 'plan_12', 'standalone_installment', 'credit', 'none'] as const;
export const KEY_KINDS = ['tantiemes', 'surface', 'equal', 'consumption', 'custom'] as const;
export const SOURCE_KINDS = ['expense', 'supplier_invoice'] as const;
export const PLAN_BASES = ['late_statement', 'agreement'] as const;

export type ExpenseKind = (typeof EXPENSE_KINDS)[number];
export type ExpenseSettlement = (typeof EXPENSE_SETTLEMENTS)[number];
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];
export type ExerciseStatus = (typeof EXERCISE_STATUSES)[number];
export type StatementStatus = (typeof STATEMENT_STATUSES)[number];
export type StatementSettlement = (typeof STATEMENT_SETTLEMENTS)[number];
export type KeyKind = (typeof KEY_KINDS)[number];
export type SourceKind = (typeof SOURCE_KINDS)[number];
export type PlanBasis = (typeof PLAN_BASES)[number];

export interface Page<Item> {
  items: Item[];
  nextCursor: string | null;
}

export interface Expense {
  id: string;
  propertyId: string;
  unitId: string | null;
  kind: ExpenseKind;
  categoryTermId: string;
  payeePartyId: string | null;
  payeeLabel: string | null;
  reference: string | null;
  documentOn: string;
  serviceFrom: string;
  serviceTo: string;
  totalGross: Money;
  taxAmount: Money;
  recoverableAmount: Money;
  recoverableRubric: string | null;
  settlement: ExpenseSettlement;
  paidOn: string | null;
  mandateId: string | null;
  mandantPartyId: string | null;
  status: ExpenseStatus;
  cancelReason: string | null;
  posted: boolean;
  files: string[];
  lockVersion: number;
  createdAt: string | null;
}

export interface ExpenseQuery {
  cursor: string | null;
  propertyId: string | null;
  status: ExpenseStatus | null;
  settlement: ExpenseSettlement | null;
  from: string | null;
  to: string | null;
}

export interface ExpenseInput {
  propertyId: string;
  unitId: string;
  kind: ExpenseKind;
  categoryTermId: string;
  payeeLabel: string;
  reference: string;
  documentOn: string;
  serviceFrom: string;
  serviceTo: string;
  totalGross: number;
  taxAmount: number;
  recoverableAmount: number;
  recoverableRubric: string;
  settlement: ExpenseSettlement;
  paidOn: string;
  document: File | null;
}

export interface ExpenseExportQuery {
  from: string;
  to: string;
  propertyId: string | null;
}

export interface KeyShare {
  unitId: string;
  weight: number;
}

export interface KeyVersion {
  id: string;
  validFrom: string;
  validTo: string | null;
  shares: KeyShare[];
}

export interface ChargeKey {
  id: string;
  propertyId: string;
  label: string;
  kind: KeyKind;
  archived: boolean;
  lockVersion: number;
  versions: KeyVersion[];
}

export interface KeyInput {
  label: string;
  kind: KeyKind;
  validFrom: string;
  shares: KeyShare[];
}

export interface Exercise {
  id: string;
  propertyId: string;
  periodStart: string;
  periodEnd: string;
  status: ExerciseStatus;
  jurisdiction: string;
  onlyLeaseId: string | null;
  prescriptionAcknowledged: boolean;
  computedAt: string | null;
  issuedAt: string | null;
  lockVersion: number;
}

export interface ItemSource {
  kind: SourceKind;
  id: string;
  amount: Money;
}

export interface ItemConsumption {
  unitId: string;
  quantityMilli: number;
}

export interface ExerciseItem {
  id: string;
  label: string;
  rubric: string;
  keyId: string | null;
  unitId: string | null;
  position: number;
  amount: Money;
  ownerShare: Money;
  sources: ItemSource[];
  consumptions: ItemConsumption[];
}

export interface StatementSummary {
  id: string;
  exerciseId: string;
  leaseId: string;
  number: string | null;
  status: StatementStatus;
  occupiedDays: number;
  shareTotal: Money;
  provisionsCalled: Money;
  provisionsUnpaid: Money;
  balance: Money;
  suggestedMonthlyProvision: Money;
  settlement: StatementSettlement | null;
  notBefore: string | null;
  issuedAt: string | null;
  supersedesId: string | null;
  failureReason: string | null;
  lockVersion: number;
}

export interface ExerciseDetail extends Exercise {
  items: ExerciseItem[];
  statements: StatementSummary[];
  excludedLeases: { leaseId: string; reason: string }[];
}

export interface ItemInput {
  label: string;
  rubric: string;
  keyId: string | null;
  unitId: string | null;
  sources: { kind: SourceKind; id: string; amount: number | null }[];
  consumptions: ItemConsumption[];
}

export interface ExerciseInput {
  propertyId: string;
  periodStart: string;
  periodEnd: string;
  items: ItemInput[];
}

export interface ExerciseQuery {
  cursor: string | null;
  propertyId: string | null;
  status: ExerciseStatus | null;
}

export interface StatementLine {
  itemId: string;
  label: string;
  rubric: string;
  splitLabel: string;
  itemAmount: Money;
  weight: number | null;
  denominator: number | null;
  days: number;
  share: Money;
}

export interface StatementFile {
  id: string;
  label: string;
  tenantVisible: boolean;
  visibleUntil: string | null;
}

export interface Statement extends StatementSummary {
  plan: { id: string; reason: string; recordedAt: string | null } | null;
  lines: StatementLine[];
  files: StatementFile[];
}

export interface PlanInput {
  reason: string;
  basis: PlanBasis;
}

export interface PropertyChoice {
  id: string;
  name: string;
}

export interface UnitChoice {
  id: string;
  reference: string;
  surfaceHundredths: number | null;
}

export interface Term {
  id: string;
  key: string;
  label: string;
  semanticKey: string | null;
  recoverableByDefault: boolean;
}

export interface ChargesPermissions {
  available: boolean;
  agency: boolean;
  write: boolean;
  thirdParty: boolean;
  issue: boolean;
  export: boolean;
}
