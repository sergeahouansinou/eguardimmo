import type { ApiClient } from '@eguardimmo/api';
import { todayIso } from '../../../locataires/kit/dates';
import type { RentSource } from '../source';
import type { InstallmentQuery, PaymentQuery, ReceiptQuery } from '../model';
import { rentPermissions } from '../permissions';
import type { RentRole } from '../permissions';
import { toBalance, toInstallment, toPayment, toReceipt } from './rentMapping';
import { paymentPayload, reasonPayload } from './rentPayloads';
import {
  apiBalanceResponse,
  apiBatchResponse,
  apiGenerationResponse,
  apiInstallmentPage,
  apiInstallmentResponse,
  apiPaymentPage,
  apiPaymentResponse,
  apiReceiptPage,
  apiReceiptResponse,
} from './rentSchemas';
import { createRentTransport } from './rentTransport';

export interface ApiRentSourceOptions {
  client: ApiClient;
  organizationId: string | null;
  role: RentRole | null;
}

export interface ApiRentSourceDependencies {
  now?: () => Date;
  fetchImpl?: typeof fetch;
}

const PAGE_SIZE = 25;
const BATCH_SIZE = 100;
const segment = (id: string): string => encodeURIComponent(id);

const installmentQuery = (query: InstallmentQuery) => ({
  per_page: query.perPage ?? PAGE_SIZE,
  cursor: query.cursor,
  lease: query.leaseId,
  status: query.status,
  due_from: query.dueFrom,
  due_to: query.dueTo,
  overdue: query.overdue === true ? 1 : undefined,
});

const paymentQuery = (query: PaymentQuery) => ({ per_page: query.perPage ?? PAGE_SIZE, cursor: query.cursor, lease: query.leaseId, status: query.status });

const receiptQuery = (query: ReceiptQuery) => ({ per_page: query.perPage ?? PAGE_SIZE, cursor: query.cursor, lease: query.leaseId });

export function createApiRentSource(
  { client, organizationId, role }: ApiRentSourceOptions,
  { now = () => new Date(), fetchImpl }: ApiRentSourceDependencies = {},
): RentSource {
  const transport = createRentTransport(client, organizationId, fetchImpl);
  const batch = async (path: string) => {
    const { data } = await transport.post(path, apiBatchResponse, { limit: BATCH_SIZE });
    return { issued: data.issued, failed: data.failed.map((entry) => ({ installmentId: entry.installment_id })), remaining: data.remaining };
  };
  const installmentAction = async (id: string, action: string, body?: Record<string, unknown>) =>
    toInstallment((await transport.post(`/installments/${segment(id)}/${action}`, apiInstallmentResponse, body)).data);

  return {
    permissions: rentPermissions(role),
    installments: async (query) => {
      const page = await transport.get('/installments', apiInstallmentPage, installmentQuery(query));
      return { items: page.data.map(toInstallment), nextCursor: page.meta.next_cursor };
    },
    installment: async (id) => toInstallment((await transport.get(`/installments/${segment(id)}`, apiInstallmentResponse)).data),
    leaseBalance: async (leaseId) => toBalance((await transport.get(`/leases/${segment(leaseId)}/balance`, apiBalanceResponse)).data),
    payments: async (query) => {
      const page = await transport.get('/payments', apiPaymentPage, paymentQuery(query));
      return { items: page.data.map(toPayment), nextCursor: page.meta.next_cursor };
    },
    recordPayment: async (input) => toPayment((await transport.post('/payments', apiPaymentResponse, paymentPayload(input, todayIso(now())))).data),
    cancelPayment: async (id, reason) => toPayment((await transport.post(`/payments/${segment(id)}/cancel`, apiPaymentResponse, reasonPayload(reason))).data),
    generateInstallments: async (leaseId) => (await transport.post(`/leases/${segment(leaseId)}/installments/generate`, apiGenerationResponse)).data,
    issueNotice: (installmentId) => installmentAction(installmentId, 'issue'),
    issueDueNotices: () => batch('/installments/issue-due'),
    cancelInstallment: (installmentId, reason) => installmentAction(installmentId, 'cancel', reasonPayload(reason)),
    receipts: async (query) => {
      const page = await transport.get('/receipts', apiReceiptPage, receiptQuery(query));
      return { items: page.data.map(toReceipt), nextCursor: page.meta.next_cursor };
    },
    receipt: async (id) => toReceipt((await transport.get(`/receipts/${segment(id)}`, apiReceiptResponse)).data),
    issueReceipt: async (installmentId) => toReceipt((await transport.post(`/installments/${segment(installmentId)}/receipt`, apiReceiptResponse)).data),
    issuePendingReceipts: () => batch('/receipts/issue-pending'),
    noticePdf: (installmentId) => transport.pdf(`/installments/${segment(installmentId)}/notice/download`),
    receiptPdf: (receiptId) => transport.pdf(`/receipts/${segment(receiptId)}/download`),
  };
}
