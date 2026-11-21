import type { ApiClient } from "@eguardimmo/api";
import type { z } from "zod";
import { parse, segment } from "../shared/parse";
import type { NewPayoutRequest, PayoutAccount, PayoutRequest } from "./model";
import { contestResponseSchema, payoutAccountsSchema, payoutRequestResponseSchema, payoutRequestSchema } from "./schemas";

export const PAYOUT_ACCOUNT_PATH = "/api/v1/owner/payout-account";
const REQUESTS_PATH = `${PAYOUT_ACCOUNT_PATH}/requests`;

export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

function toRequest(value: z.infer<typeof payoutRequestSchema>): PayoutRequest {
  return {
    id: value.id,
    accessId: value.access_id,
    status: value.status,
    bankLast4: value.bank_last4,
    holderName: value.holder_name,
    requestedAt: value.requested_at,
    codeExpiresAt: value.code_expires_at,
    decidedAt: value.decided_at,
  };
}

export async function fetchPayoutAccounts(client: ApiClient): Promise<PayoutAccount[]> {
  return parse(payoutAccountsSchema, await client.get(PAYOUT_ACCOUNT_PATH)).data.map((account) => ({
    accessId: account.access_id,
    agencyId: account.agency_id,
    agencyName: account.agency_name,
    mandantName: account.mandant_name,
    role: account.role,
    canRequest: account.can_request,
    current: account.current === null ? null : { bankLast4: account.current.bank_last4, activeSince: account.current.active_since },
    coolingUntil: account.cooling_until,
    contested: account.contested,
    request: account.request === null ? null : toRequest(account.request),
  }));
}

export async function createPayoutRequest(client: ApiClient, input: NewPayoutRequest): Promise<PayoutRequest> {
  const form = new FormData();
  form.set("access_id", input.accessId);
  form.set("iban", normalizeIban(input.iban));
  form.set("holder_name", input.holderName.trim());
  if (input.bic !== null && input.bic.trim() !== "") form.set("bic", input.bic.trim().toUpperCase());
  form.set("proof", input.proof);
  return toRequest(parse(payoutRequestResponseSchema, await client.post(REQUESTS_PATH, form)).data);
}

export async function confirmPayoutRequest(client: ApiClient, requestId: string, code: string): Promise<PayoutRequest> {
  return toRequest(parse(payoutRequestResponseSchema, await client.post(`${REQUESTS_PATH}/${segment(requestId)}/confirm`, { code })).data);
}

export async function withdrawPayoutRequest(client: ApiClient, requestId: string): Promise<PayoutRequest> {
  return toRequest(parse(payoutRequestResponseSchema, await client.delete(`${REQUESTS_PATH}/${segment(requestId)}`)).data);
}

export async function contestPayoutAccount(client: ApiClient, accessId: string): Promise<void> {
  parse(contestResponseSchema, await client.post(`${PAYOUT_ACCOUNT_PATH}/contest`, { access_id: accessId }));
}
