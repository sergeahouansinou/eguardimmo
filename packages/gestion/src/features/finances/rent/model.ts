import type { Currency } from '../../../format/money';

export interface Money {
  amount: number;
  currency: Currency;
}

export const INSTALLMENT_STATUSES = ['upcoming', 'issued', 'partially_paid', 'paid', 'cancelled'] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['transfer', 'cheque', 'cash', 'direct_debit'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['recorded', 'cancelled'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const RECEIPT_STATES = ['issued', 'on_demand', 'pending', 'not_due'] as const;
export type ReceiptState = (typeof RECEIPT_STATES)[number];

export interface RentInstallmentLine {
  id: string;
  label: string;
  componentKey: string;
  semantic: string | null;
  from: string;
  to: string;
  days: number;
  monthDays: number;
  monthlyAmount: Money;
  amount: Money;
  vatBp: number;
  vatAmount: Money;
}

export interface RentInstallment {
  id: string;
  leaseId: string;
  leaseReference: string | null;
  partyId: string;
  unitId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: InstallmentStatus;
  isOverdue: boolean;
  rent: Money;
  charges: Money;
  vat: Money;
  total: Money;
  outstanding: Money | null;
  issuedOn: string | null;
  cancelledOn: string | null;
  cancellationReason: string | null;
  notice: { id: string; number: string; issuedOn: string; fingerprint: string } | null;
  receipt: { id: string; number: string; issuedOn: string } | null;
  receiptState: ReceiptState;
  lines: RentInstallmentLine[] | null;
}

export interface RentPayment {
  id: string;
  leaseId: string;
  partyId: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amount: Money;
  receivedOn: string;
  reference: string | null;
  note: string | null;
  cancelledOn: string | null;
  cancellationReason: string | null;
  recordedAt: string | null;
  allocations: { installmentId: string; amount: Money }[] | null;
  advance: Money | null;
  replayed: boolean | null;
  receipts: Record<string, ReceiptState> | null;
}

export interface RentBalance {
  leaseId: string;
  balance: Money;
  overdue: Money;
  advance: Money;
  unpaidCount: number;
  oldestUnpaidDueDate: string | null;
}

export interface RentReceiptSnapshot {
  issuerName: string | null;
  paidOn: string | null;
  lines: { label: string; from: string; to: string; amount: Money }[];
  payments: { receivedOn: string; method: PaymentMethod; amount: Money }[];
  mention: string | null;
}

export interface RentReceipt {
  id: string;
  number: string;
  leaseId: string;
  leaseReference: string | null;
  installmentId: string;
  tenants: string[];
  unitReference: string | null;
  propertyName: string | null;
  address: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  dueDate: string | null;
  rent: Money;
  charges: Money;
  vat: Money;
  total: Money;
  issuedOn: string;
  fingerprint: string;
  isVoid: boolean;
  voidedAt: string | null;
  voidReason: string | null;
  snapshot: RentReceiptSnapshot | null;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PageQuery {
  cursor?: string | null;
  perPage?: number;
}

export interface InstallmentQuery extends PageQuery {
  leaseId?: string;
  status?: InstallmentStatus;
  dueFrom?: string;
  dueTo?: string;
  overdue?: boolean;
}

export interface PaymentQuery extends PageQuery {
  leaseId?: string;
  status?: PaymentStatus;
}

export interface ReceiptQuery extends PageQuery {
  leaseId?: string;
}

export interface BatchOutcome {
  issued: number;
  failed: { installmentId: string }[];
  remaining: boolean;
}

export interface GenerationOutcome {
  created: number;
  existing: number;
}

export interface PaymentInput {
  leaseId: string;
  amount: string;
  currency: Currency;
  method: PaymentMethod;
  receivedOn: string;
  reference: string;
  note: string;
  idempotencyKey: string;
}

export interface RentPermissions {
  recordPayment: boolean;
  manage: boolean;
}
