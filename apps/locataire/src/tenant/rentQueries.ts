'use client';

import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { tenantKeys } from './keys';
import type { InstallmentFilters } from './rentModel';
import {
  fetchInstallment,
  fetchInstallmentsPage,
  fetchPayment,
  fetchPaymentsPage,
  fetchPdf,
  fetchReceipt,
  fetchReceiptsPage,
} from './rentRequests';
import { saveBlob } from './download';
import { useTenantSession } from './session';

export function useInstallments(filters: InstallmentFilters) {
  const { client } = useTenantSession();
  return useInfiniteQuery({
    queryKey: tenantKeys.installments(filters.leaseId, filters.status),
    queryFn: ({ pageParam }) => fetchInstallmentsPage(client, filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

export function useInstallment(id: string) {
  const { client } = useTenantSession();
  return useQuery({ queryKey: tenantKeys.installment(id), queryFn: () => fetchInstallment(client, id) });
}

export function useReceipts(leaseId: string | null) {
  const { client } = useTenantSession();
  return useInfiniteQuery({
    queryKey: tenantKeys.receipts(leaseId),
    queryFn: ({ pageParam }) => fetchReceiptsPage(client, leaseId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

export function useReceipt(id: string) {
  const { client } = useTenantSession();
  return useQuery({ queryKey: tenantKeys.receipt(id), queryFn: () => fetchReceipt(client, id) });
}

export function usePayments(leaseId: string | null) {
  const { client } = useTenantSession();
  return useInfiniteQuery({
    queryKey: tenantKeys.payments(leaseId),
    queryFn: ({ pageParam }) => fetchPaymentsPage(client, leaseId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

export function usePayment(id: string) {
  const { client } = useTenantSession();
  return useQuery({ queryKey: tenantKeys.payment(id), queryFn: () => fetchPayment(client, id) });
}

export interface PdfRequest {
  path: string;
  filename: string;
}

export function usePdfDownload() {
  const { client } = useTenantSession();
  return useMutation({
    mutationFn: async ({ path, filename }: PdfRequest) => {
      saveBlob(await fetchPdf(client, path), filename);
    },
  });
}
