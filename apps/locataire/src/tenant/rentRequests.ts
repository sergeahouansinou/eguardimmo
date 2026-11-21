import type { ApiClient } from '@eguardimmo/api';
import { fetchBlob } from './blobRequests';
import { parse } from './requests';
import { toInstallment, toPayment, toReceipt } from './rentMapping';
import type { CursorPage, Installment, InstallmentFilters, Payment, Receipt } from './rentModel';
import { installmentPageSchema, installmentSchema, paymentPageSchema, paymentSchema, receiptPageSchema, receiptSchema } from './rentSchemas';

export const RENT_PATH = '/api/v1/tenant/rent';
const segment = encodeURIComponent;

export async function fetchInstallmentsPage(client: ApiClient, filters: InstallmentFilters, cursor: string | null): Promise<CursorPage<Installment>> {
  const page = parse(installmentPageSchema, await client.get(`${RENT_PATH}/installments`, { lease: filters.leaseId, status: filters.status, cursor }));
  return { items: page.data.map(toInstallment), nextCursor: page.meta.next_cursor };
}

export async function fetchInstallment(client: ApiClient, id: string): Promise<Installment> {
  return toInstallment(parse(installmentSchema, await client.get(`${RENT_PATH}/installments/${segment(id)}`)).data);
}

export async function fetchReceiptsPage(client: ApiClient, leaseId: string | null, cursor: string | null): Promise<CursorPage<Receipt>> {
  const page = parse(receiptPageSchema, await client.get(`${RENT_PATH}/receipts`, { lease: leaseId, cursor }));
  return { items: page.data.map(toReceipt), nextCursor: page.meta.next_cursor };
}

export async function fetchReceipt(client: ApiClient, id: string): Promise<Receipt> {
  return toReceipt(parse(receiptSchema, await client.get(`${RENT_PATH}/receipts/${segment(id)}`)).data);
}

export async function fetchPaymentsPage(client: ApiClient, leaseId: string | null, cursor: string | null): Promise<CursorPage<Payment>> {
  const page = parse(paymentPageSchema, await client.get(`${RENT_PATH}/payments`, { lease: leaseId, cursor }));
  return { items: page.data.map(toPayment), nextCursor: page.meta.next_cursor };
}

export async function fetchPayment(client: ApiClient, id: string): Promise<Payment> {
  return toPayment(parse(paymentSchema, await client.get(`${RENT_PATH}/payments/${segment(id)}`)).data);
}

export const noticePdfPath = (installmentId: string): string => `${RENT_PATH}/installments/${segment(installmentId)}/notice/download`;
export const receiptPdfPath = (receiptId: string): string => `${RENT_PATH}/receipts/${segment(receiptId)}/download`;

export function fetchPdf(client: ApiClient, path: string, fetchImpl?: typeof fetch): Promise<Blob> {
  return fetchBlob(client, path, ['application/pdf'], fetchImpl);
}
