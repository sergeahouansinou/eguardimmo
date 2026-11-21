'use client';

import { MissingSourceError, createSourceContext } from '../../locataires/kit/sourceContext';
import type {
  BatchOutcome,
  GenerationOutcome,
  InstallmentQuery,
  Page,
  PaymentInput,
  PaymentQuery,
  ReceiptQuery,
  RentBalance,
  RentInstallment,
  RentPayment,
  RentPermissions,
  RentReceipt,
} from './model';

export interface RentSource {
  readonly permissions: RentPermissions;
  installments: (query: InstallmentQuery) => Promise<Page<RentInstallment>>;
  installment: (id: string) => Promise<RentInstallment>;
  leaseBalance: (leaseId: string) => Promise<RentBalance>;
  payments: (query: PaymentQuery) => Promise<Page<RentPayment>>;
  recordPayment: (input: PaymentInput) => Promise<RentPayment>;
  cancelPayment: (id: string, reason: string) => Promise<RentPayment>;
  generateInstallments: (leaseId: string) => Promise<GenerationOutcome>;
  issueNotice: (installmentId: string) => Promise<RentInstallment>;
  issueDueNotices: () => Promise<BatchOutcome>;
  cancelInstallment: (installmentId: string, reason: string) => Promise<RentInstallment>;
  receipts: (query: ReceiptQuery) => Promise<Page<RentReceipt>>;
  receipt: (id: string) => Promise<RentReceipt>;
  issueReceipt: (installmentId: string) => Promise<RentReceipt>;
  issuePendingReceipts: () => Promise<BatchOutcome>;
  noticePdf: (installmentId: string) => Promise<Blob>;
  receiptPdf: (receiptId: string) => Promise<Blob>;
}

const context = createSourceContext<RentSource>('Loyers', () => {
  throw new MissingSourceError('Loyers');
});

export const RentSourceProvider = context.SourceProvider;
export const useRentSource = context.useSource;
