'use client';

import { MissingSourceError, createSourceContext } from '../../locataires/kit/sourceContext';
import type {
  CreditNoteInput,
  DraftInput,
  Invoice,
  InvoicePayment,
  InvoiceQuery,
  InvoicingPermissions,
  ItemTerm,
  Page,
  PaymentInput,
  Recipient,
} from './model';

export interface InvoicingSource {
  readonly permissions: InvoicingPermissions;
  invoices: (query: InvoiceQuery) => Promise<Page<Invoice>>;
  invoice: (id: string) => Promise<Invoice>;
  saveDraft: (input: DraftInput) => Promise<Invoice>;
  discardDraft: (id: string) => Promise<Invoice>;
  issue: (id: string) => Promise<Invoice>;
  recordPayment: (invoiceId: string, input: PaymentInput) => Promise<InvoicePayment>;
  cancelPayment: (paymentId: string) => Promise<InvoicePayment>;
  createCreditNote: (invoiceId: string, input: CreditNoteInput) => Promise<Invoice>;
  send: (id: string) => Promise<Invoice>;
  pdf: (id: string) => Promise<Blob>;
  recipients: () => Promise<Recipient[]>;
  itemTerms: () => Promise<ItemTerm[]>;
}

const context = createSourceContext<InvoicingSource>('Facturation', () => {
  throw new MissingSourceError('Facturation');
});

export const InvoicingSourceProvider = context.SourceProvider;
export const useInvoicingSource = context.useSource;
