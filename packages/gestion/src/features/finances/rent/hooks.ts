'use client';

import { useAfterHydration } from '@eguardimmo/shell';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InstallmentQuery, PaymentInput, PaymentQuery, ReceiptQuery } from './model';
import { useRentSource } from './source';

export const RENT_ROOT = ['gestion', 'rent'] as const;

export const rentKeys = {
  installments: (query: InstallmentQuery) => [...RENT_ROOT, 'installments', query] as const,
  installment: (id: string) => [...RENT_ROOT, 'installment', id] as const,
  balance: (leaseId: string) => [...RENT_ROOT, 'balance', leaseId] as const,
  payments: (query: PaymentQuery) => [...RENT_ROOT, 'payments', query] as const,
  receipts: (query: ReceiptQuery) => [...RENT_ROOT, 'receipts', query] as const,
  receipt: (id: string) => [...RENT_ROOT, 'receipt', id] as const,
};

export interface RentQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
  error: Error | null;
}

function useRentQuery<T>(key: readonly unknown[], load: () => Promise<T>, enabled = true): RentQuery<T> {
  const query = useQuery({ queryKey: key, queryFn: load, enabled, retry: false });
  const settled = useAfterHydration(query);
  return { ...settled, error: settled.isError ? query.error : null };
}

export const useRentPermissions = () => useRentSource().permissions;

export function useInstallments(query: InstallmentQuery) {
  const source = useRentSource();
  return useRentQuery(rentKeys.installments(query), () => source.installments(query));
}

export function useInstallment(id: string) {
  const source = useRentSource();
  return useRentQuery(rentKeys.installment(id), () => source.installment(id));
}

export function useLeaseBalance(leaseId: string | null) {
  const source = useRentSource();
  return useRentQuery(rentKeys.balance(leaseId ?? ''), () => source.leaseBalance(leaseId ?? ''), leaseId !== null && leaseId !== '');
}

export function usePayments(query: PaymentQuery) {
  const source = useRentSource();
  return useRentQuery(rentKeys.payments(query), () => source.payments(query));
}

export function useReceipts(query: ReceiptQuery) {
  const source = useRentSource();
  return useRentQuery(rentKeys.receipts(query), () => source.receipts(query));
}

export function useReceipt(id: string) {
  const source = useRentSource();
  return useRentQuery(rentKeys.receipt(id), () => source.receipt(id));
}

function useRentMutation<I, O>(run: (input: I) => Promise<O>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => client.invalidateQueries({ queryKey: RENT_ROOT }),
  });
}

export function useRecordPayment() {
  const source = useRentSource();
  return useRentMutation((input: PaymentInput) => source.recordPayment(input));
}

export function useCancelPayment() {
  const source = useRentSource();
  return useRentMutation(({ id, reason }: { id: string; reason: string }) => source.cancelPayment(id, reason));
}

export function useGenerateInstallments() {
  const source = useRentSource();
  return useRentMutation((leaseId: string) => source.generateInstallments(leaseId));
}

export function useIssueNotice() {
  const source = useRentSource();
  return useRentMutation((installmentId: string) => source.issueNotice(installmentId));
}

export function useIssueDueNotices() {
  const source = useRentSource();
  return useRentMutation(() => source.issueDueNotices());
}

export function useCancelInstallment() {
  const source = useRentSource();
  return useRentMutation(({ id, reason }: { id: string; reason: string }) => source.cancelInstallment(id, reason));
}

export function useIssueReceipt() {
  const source = useRentSource();
  return useRentMutation((installmentId: string) => source.issueReceipt(installmentId));
}

export function useIssuePendingReceipts() {
  const source = useRentSource();
  return useRentMutation(() => source.issuePendingReceipts());
}

export function useNoticePdf() {
  const source = useRentSource();
  return useMutation({ mutationFn: (installmentId: string) => source.noticePdf(installmentId) });
}

export function useReceiptPdf() {
  const source = useRentSource();
  return useMutation({ mutationFn: (receiptId: string) => source.receiptPdf(receiptId) });
}
