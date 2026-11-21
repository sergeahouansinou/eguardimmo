import type { Money } from './model';

export type InstallmentStatus = 'issued' | 'partially_paid' | 'paid';
export type PaymentStatus = 'recorded' | 'cancelled';
export type PaymentMethod = 'transfer' | 'cheque' | 'cash' | 'direct_debit';

export interface LeaseRef {
  id: string;
  reference: string | null;
}

export interface AmountBreakdown {
  rent: Money;
  charges: Money;
  vat: Money;
  total: Money;
}

export interface InstallmentLine {
  label: string;
  from: string;
  to: string;
  days: number;
  monthDays: number;
  amount: Money;
  vatBasisPoints: number;
  vatAmount: Money;
}

export interface Installment {
  id: string;
  lease: LeaseRef;
  periodStart: string;
  periodEnd: string;
  dueOn: string;
  status: InstallmentStatus;
  isOverdue: boolean;
  amounts: AmountBreakdown;
  outstanding: Money | null;
  issuedOn: string | null;
  notice: { number: string; issuedOn: string } | null;
  receipt: { id: string; number: string; issuedOn: string } | null;
  lines: InstallmentLine[] | null;
}

export interface Receipt {
  id: string;
  number: string;
  lease: LeaseRef;
  installmentId: string | null;
  issuer: string | null;
  tenants: string[];
  unit: { reference: string | null; propertyName: string | null; address: string | null } | null;
  periodStart: string | null;
  periodEnd: string | null;
  amounts: AmountBreakdown;
  issuedOn: string;
  isVoid: boolean;
  voidedAt: string | null;
  paidOn: string | null;
}

export interface Payment {
  id: string;
  lease: LeaseRef;
  status: PaymentStatus;
  method: PaymentMethod;
  amount: Money;
  receivedOn: string;
  cancelledOn: string | null;
  allocations: { installmentId: string; amount: Money }[] | null;
}

export interface CursorPage<Item> {
  items: Item[];
  nextCursor: string | null;
}

export interface InstallmentFilters {
  leaseId: string | null;
  status: InstallmentStatus | null;
}
