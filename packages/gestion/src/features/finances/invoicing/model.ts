import type { Currency } from '../../../format/money';

export interface Money {
  amount: number;
  currency: Currency;
}

export const INVOICE_KINDS = ['invoice', 'credit_note'] as const;
export type InvoiceKind = (typeof INVOICE_KINDS)[number];

export const INVOICE_STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'cancelled', 'discarded'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const TAX_CATEGORIES = ['S', 'Z', 'E', 'AE', 'O'] as const;
export type TaxCategory = (typeof TAX_CATEGORIES)[number];

export const TAX_CODES = ['vat', 'gst', 'qst'] as const;
export type TaxCode = (typeof TAX_CODES)[number];

export const PAYMENT_METHODS = ['transfer', 'cheque', 'cash', 'direct_debit'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface InvoiceLine {
  id: string;
  position: number;
  itemTermId: string;
  description: string;
  quantityMilli: number;
  unitPrice: Money;
  netAmount: Money;
  taxCategory: TaxCategory;
  taxRatePcm: number;
  creditedLineId: string | null;
}

export interface InvoiceTax {
  taxCode: TaxCode;
  category: TaxCategory;
  ratePcm: number;
  base: Money;
  amount: Money;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: Money;
  method: PaymentMethod;
  paidOn: string;
  reference: string | null;
  cancelledAt: string | null;
  recordedAt: string | null;
  replayed: boolean | null;
}

export interface Invoice {
  id: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  number: string | null;
  creditedInvoiceId: string | null;
  issuedOn: string | null;
  dueOn: string | null;
  serviceFrom: string | null;
  serviceTo: string | null;
  recipientPartyId: string;
  leaseId: string | null;
  mandateId: string | null;
  totalNet: Money;
  totalTax: Money;
  totalGross: Money;
  outstanding: Money | null;
  creditReason: string | null;
  lockVersion: number;
  isOverdue: boolean;
  sentAt: string | null;
  createdAt: string | null;
  lines: InvoiceLine[] | null;
  taxes: InvoiceTax[] | null;
  payments: InvoicePayment[] | null;
  replayed: boolean | null;
}

export const SEND_LIMIT_PER_INVOICE = 3;
export const SEND_LIMIT_PER_ORGANIZATION = 60;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface InvoiceQuery {
  cursor?: string | null;
  perPage?: number;
  kind?: InvoiceKind;
  status?: InvoiceStatus;
  year?: number;
  search?: string;
  overdue?: boolean;
  partyId?: string;
}

export interface Recipient {
  id: string;
  name: string;
  email: string | null;
  anonymized: boolean;
  archived: boolean;
}

export interface ItemTerm {
  id: string;
  label: string;
  semantic: string | null;
}

export interface DraftLineInput {
  itemTermId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxCategory: TaxCategory;
}

export interface DraftInput {
  invoiceId: string | null;
  lockVersion: number | null;
  idempotencyKey: string | null;
  recipientPartyId: string;
  leaseId: string | null;
  mandateId: string | null;
  currency: Currency;
  dueOn: string;
  serviceFrom: string;
  serviceTo: string;
  lines: DraftLineInput[];
}

export interface PaymentInput {
  amount: string;
  currency: Currency;
  method: PaymentMethod;
  paidOn: string;
  reference: string;
  idempotencyKey: string;
}

export interface CreditLineInput {
  lineId: string;
  quantity: string;
}

export interface CreditNoteInput {
  reason: string;
  full: boolean;
  lines: CreditLineInput[];
  idempotencyKey: string;
}

export interface InvoicingPermissions {
  available: boolean;
  write: boolean;
  credit: boolean;
}
