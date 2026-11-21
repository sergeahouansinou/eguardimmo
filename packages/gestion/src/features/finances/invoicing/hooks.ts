'use client';

import { useAfterHydration } from '@eguardimmo/shell';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreditNoteInput, DraftInput, InvoiceQuery, PaymentInput } from './model';
import { useInvoicingSource } from './source';

export const INVOICING_ROOT = ['gestion', 'invoicing'] as const;

export const invoicingKeys = {
  invoices: (query: InvoiceQuery) => [...INVOICING_ROOT, 'invoices', query] as const,
  invoice: (id: string) => [...INVOICING_ROOT, 'invoice', id] as const,
  recipients: [...INVOICING_ROOT, 'recipients'] as const,
  itemTerms: [...INVOICING_ROOT, 'item-terms'] as const,
};

export interface InvoicingQuery<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
  error: Error | null;
}

function useInvoicingQuery<T>(key: readonly unknown[], load: () => Promise<T>, enabled = true): InvoicingQuery<T> {
  const query = useQuery({ queryKey: key, queryFn: load, enabled, retry: false });
  const settled = useAfterHydration(query);
  return { ...settled, error: settled.isError ? query.error : null };
}

export const useInvoicingPermissions = () => useInvoicingSource().permissions;

export function useInvoices(query: InvoiceQuery, enabled = true) {
  const source = useInvoicingSource();
  return useInvoicingQuery(invoicingKeys.invoices(query), () => source.invoices(query), enabled);
}

export function useInvoice(id: string) {
  const source = useInvoicingSource();
  return useInvoicingQuery(invoicingKeys.invoice(id), () => source.invoice(id));
}

export function useRecipients() {
  const source = useInvoicingSource();
  const query = useQuery({ queryKey: invoicingKeys.recipients, queryFn: () => source.recipients(), retry: false, staleTime: 60_000, enabled: source.permissions.available });
  return query;
}

export function useItemTerms() {
  const source = useInvoicingSource();
  return useQuery({ queryKey: invoicingKeys.itemTerms, queryFn: () => source.itemTerms(), retry: false, staleTime: 60_000, enabled: source.permissions.available });
}

function useInvoicingMutation<I, O>(run: (input: I) => Promise<O>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => client.invalidateQueries({ queryKey: INVOICING_ROOT }),
  });
}

export function useSaveDraft() {
  const source = useInvoicingSource();
  return useInvoicingMutation((input: DraftInput) => source.saveDraft(input));
}

export function useDiscardDraft() {
  const source = useInvoicingSource();
  return useInvoicingMutation((id: string) => source.discardDraft(id));
}

export function useIssueInvoice() {
  const source = useInvoicingSource();
  return useInvoicingMutation((id: string) => source.issue(id));
}

export function useRecordInvoicePayment() {
  const source = useInvoicingSource();
  return useInvoicingMutation(({ invoiceId, input }: { invoiceId: string; input: PaymentInput }) => source.recordPayment(invoiceId, input));
}

export function useCancelInvoicePayment() {
  const source = useInvoicingSource();
  return useInvoicingMutation((paymentId: string) => source.cancelPayment(paymentId));
}

export function useCreateCreditNote() {
  const source = useInvoicingSource();
  return useInvoicingMutation(({ invoiceId, input }: { invoiceId: string; input: CreditNoteInput }) => source.createCreditNote(invoiceId, input));
}

export function useSendInvoice() {
  const source = useInvoicingSource();
  return useInvoicingMutation((id: string) => source.send(id));
}

export function useInvoicePdf() {
  const source = useInvoicingSource();
  return useMutation({ mutationFn: (id: string) => source.pdf(id) });
}
