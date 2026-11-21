import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import { createConfirmProof } from '../../reauth/proof';
import { id, money, pageOf, timestamp } from '../shared/schemas';
import { createTransport } from '../shared/transport';
import { ACCOUNT_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from './model';
import type { OnlinePayment, PaymentAccount } from './model';
import type { OnlinePaymentsSource } from './source';

export const apiPaymentSchema = z.object({
  id,
  lease_id: id,
  party_id: id,
  status: z.enum(PAYMENT_STATUSES),
  method: z.enum(PAYMENT_METHODS),
  amount: money,
  installment_ids: z.array(id),
  provider: z.string(),
  provider_reference: z.string().nullable(),
  failure_code: z.string().nullable(),
  created_by_user_id: id,
  created_at: timestamp,
  confirmed_at: timestamp.nullable(),
});

export const apiAccountSchema = z.object({
  provider: z.string(),
  status: z.enum(ACCOUNT_STATUSES),
  ready: z.boolean(),
  onboarded_at: timestamp.nullable(),
  onboarding_url: z.url({ protocol: /^https$/ }).nullable(),
});

const apiPaymentPage = pageOf(apiPaymentSchema);
const apiAccountResponse = z.object({ data: apiAccountSchema.nullable() });
const apiOnboardResponse = z.object({ data: apiAccountSchema });

export const toPayment = (row: z.infer<typeof apiPaymentSchema>): OnlinePayment => ({
  id: row.id,
  leaseId: row.lease_id,
  partyId: row.party_id,
  status: row.status,
  method: row.method,
  amount: row.amount,
  installmentCount: row.installment_ids.length,
  provider: row.provider,
  providerReference: row.provider_reference,
  failureCode: row.failure_code,
  createdAt: row.created_at,
  confirmedAt: row.confirmed_at,
});

const toAccount = (row: z.infer<typeof apiAccountSchema>): PaymentAccount => ({
  provider: row.provider,
  status: row.status,
  ready: row.ready,
  onboardedAt: row.onboarded_at,
  onboardingUrl: row.onboarding_url,
});

const PAGE_SIZE = 25;

export interface ApiOnlinePaymentsOptions {
  client: ApiClient;
  organizationId: string | null;
  fetchImpl?: typeof fetch;
}

export function createApiOnlinePaymentsSource({ client, organizationId, fetchImpl }: ApiOnlinePaymentsOptions): OnlinePaymentsSource {
  const transport = createTransport(client, organizationId, fetchImpl);
  return {
    list: async (query) => {
      const page = await transport.get('/online-payments', apiPaymentPage, {
        per_page: PAGE_SIZE,
        cursor: query.cursor,
        status: query.status ?? undefined,
        lease_id: query.leaseId ?? undefined,
      });
      return { items: page.data.map(toPayment), nextCursor: page.meta.next_cursor };
    },
    account: async () => {
      const { data } = await transport.get('/payments/account', apiAccountResponse);
      return data === null ? null : toAccount(data);
    },
    onboard: async () => toAccount((await transport.post('/payments/account', apiOnboardResponse)).data),
    confirmTwoFactor: createConfirmProof(client),
  };
}
