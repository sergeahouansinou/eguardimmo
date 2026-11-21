import type { ApiClient } from '@eguardimmo/api';
import { onlinePaymentSchema, optionsSchema } from './onlinePaymentSchemas';
import type { OnlineMethod, OnlinePayment, PaymentOptions } from './onlinePaymentSchemas';
import { parse } from './requests';

const BASE = '/api/v1/tenant/online-payments';

export interface PayInput {
  leaseId: string;
  installmentIds: readonly string[];
  method: OnlineMethod;
  clientId: string;
}

export async function fetchPaymentOptions(client: ApiClient, leaseId: string): Promise<PaymentOptions> {
  return parse(optionsSchema, await client.get(`${BASE}/options`, { lease: leaseId })).data;
}

export async function createOnlinePayment(client: ApiClient, input: PayInput): Promise<OnlinePayment> {
  const body = { lease: input.leaseId, installments: [...input.installmentIds], method: input.method, client_id: input.clientId };
  return parse(onlinePaymentSchema, await client.post(BASE, body)).data;
}

export async function fetchOnlinePayment(client: ApiClient, id: string): Promise<OnlinePayment> {
  return parse(onlinePaymentSchema, await client.get(`${BASE}/${encodeURIComponent(id)}`)).data;
}

export async function cancelOnlinePayment(client: ApiClient, id: string): Promise<OnlinePayment> {
  return parse(onlinePaymentSchema, await client.post(`${BASE}/${encodeURIComponent(id)}/cancel`)).data;
}
