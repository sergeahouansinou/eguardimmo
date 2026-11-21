import { z } from 'zod';
import { CURRENCIES } from '../../../../format/money';
import { BATCH_STATUSES, DEPOSIT_STATUSES, EXCLUSION_REASONS, FEE_KINDS, HOLD_KINDS, HOLD_REASONS, ITEM_STATUSES, PAYOUT_REQUEST_STATUSES } from '../model';

const id = z.guid();
const timestamp = z.iso.datetime({ offset: true });
const isoDate = z.iso.date();
const money = z.object({ amount: z.number().int(), currency: z.enum(CURRENCIES) });
const cursorMeta = z.object({ per_page: z.number().int().nonnegative(), next_cursor: z.string().nullable() });

export const apiEvaluationSchema = z.object({
  mandant_party_id: id,
  payable: money,
  in_transit: money,
  called_not_collected: money,
  fees_due: money,
  fees_estimated: money,
  reserve: money,
  full_hold: z.boolean(),
  net_payable: money,
  bank_last4: z.string().max(4).nullable(),
  exclusion_reason: z.enum(EXCLUSION_REASONS).nullable(),
});

export const apiItemSchema = z.object({
  id,
  batch_id: id,
  mandant_party_id: id,
  status: z.enum(ITEM_STATUSES),
  exclusion_reason: z.enum(EXCLUSION_REASONS).nullable(),
  net_amount: money,
  fees_settled_amount: money,
  bank_account_id: id.nullable(),
  bank_last4: z.string().max(4).nullable(),
  executed_on: isoDate.nullable(),
  bank_reference: z.string().nullable(),
  executed_solo: z.boolean(),
  failure_reason: z.string().nullable(),
  lock_version: z.number().int().positive(),
});

export const apiBatchSchema = z.object({
  id,
  number: z.string().nullable(),
  status: z.enum(BATCH_STATUSES),
  currency: z.string().length(3),
  lock_version: z.number().int().positive(),
  second_approver_required: z.boolean(),
  validated_at: timestamp.nullable(),
  cancelled_at: timestamp.nullable(),
  cancel_reason: z.string().nullable(),
  created_at: timestamp.nullable(),
  items: z.array(apiItemSchema).optional(),
});

export const apiHoldSchema = z.object({
  id,
  mandant_party_id: id,
  kind: z.enum(HOLD_KINDS),
  amount: money.nullable(),
  reason: z.enum(HOLD_REASONS),
  comment: z.string().nullable(),
  placed_by_user_id: id.nullable(),
  released_at: timestamp.nullable(),
  created_at: timestamp.nullable(),
});

export const apiFeeSchema = z.object({
  id,
  mandate_id: id,
  mandant_party_id: id,
  month: z.string().regex(/^\d{4}-\d{2}$/),
  base_rent: money,
  base_charges: money,
  fee_kind: z.enum(FEE_KINDS),
  rate_bp: z.number().int().nullable(),
  minimum_applied: z.boolean(),
  fee_net: money,
  tax_amount: money,
  fee_total: money,
  carried_net: money,
  invoice_id: id.nullable(),
  credit_note_id: id.nullable(),
});

export const apiCoverageSchema = z.object({
  trust_bank: money,
  owner_payable: money,
  payouts_in_transit: money,
  security_deposits: money,
  tenant_advances: money,
  required: money,
  surplus: money,
  covered: z.boolean(),
});

export const apiDepositSchema = z.object({
  id,
  status: z.enum(DEPOSIT_STATUSES),
  amount: money,
  executed_on: isoDate,
  bank_reference: z.string(),
  second_approver_required: z.boolean(),
  requested_by_user_id: id.nullable(),
  confirmed_by_user_id: id.nullable(),
  confirmed_at: timestamp.nullable(),
  confirmed_solo: z.boolean(),
  trust_transfer_id: id.nullable(),
  created_at: timestamp.nullable(),
});

export const apiTransferSchema = z.object({
  id,
  direction: z.enum(['withdraw_fees', 'deposit']),
  amount: money,
  executed_on: isoDate,
  bank_reference: z.string().nullable(),
  ledger_entry_id: id.nullable(),
});

export const apiPeriodSchema = z.object({
  id,
  month: z.string().regex(/^\d{4}-\d{2}$/),
  period_start: isoDate,
  period_end_exclusive: isoDate,
  closed_at: timestamp,
  closed_by_user_id: id.nullable(),
});

export const apiPayoutRequestSchema = z.object({
  id,
  mandant_party_id: id,
  status: z.enum(PAYOUT_REQUEST_STATUSES),
  bank_account_id: id,
  bank_last4: z.string().max(4).nullable(),
  holder_name: z.string().nullable(),
  proof_file_id: id.nullable(),
  requested_by_user_id: id.nullable(),
  decided_by_user_id: id.nullable(),
  decided_at: timestamp.nullable(),
  reject_reason: z.string().nullable(),
  lock_version: z.number().int().positive(),
  created_at: timestamp.nullable(),
});

export const apiEvaluationResponse = z.object({ data: apiEvaluationSchema });
export const apiPreviewResponse = z.object({ data: z.array(apiEvaluationSchema), meta: z.object({ limit: z.number().int().positive(), truncated: z.boolean() }) });
export const apiBatchResponse = z.object({ data: apiBatchSchema });
export const apiBatchPage = z.object({ data: z.array(apiBatchSchema), meta: cursorMeta });
export const apiItemResponse = z.object({ data: apiItemSchema });
export const apiHoldResponse = z.object({ data: apiHoldSchema });
export const apiHoldPage = z.object({ data: z.array(apiHoldSchema), meta: cursorMeta });
export const apiFeePage = z.object({ data: z.array(apiFeeSchema), meta: cursorMeta });
export const apiCoverageResponse = z.object({ data: apiCoverageSchema });
export const apiDepositResponse = z.object({ data: apiDepositSchema });
export const apiDepositPage = z.object({ data: z.array(apiDepositSchema), meta: cursorMeta });
export const apiTransferResponse = z.object({ data: apiTransferSchema });
export const apiPeriodList = z.object({ data: z.array(apiPeriodSchema) });
export const apiCloseResponse = z.object({ data: apiPeriodSchema, warnings: z.array(z.string()) });
export const apiPayoutRequestResponse = z.object({ data: apiPayoutRequestSchema });
export const apiPayoutRequestPage = z.object({ data: z.array(apiPayoutRequestSchema), meta: cursorMeta });
export const apiPartyResponse = z.object({ data: z.object({ id, display_name: z.string(), is_anonymized: z.boolean() }) });

export type ApiEvaluation = z.infer<typeof apiEvaluationSchema>;
export type ApiItem = z.infer<typeof apiItemSchema>;
export type ApiBatch = z.infer<typeof apiBatchSchema>;
export type ApiHold = z.infer<typeof apiHoldSchema>;
export type ApiFee = z.infer<typeof apiFeeSchema>;
export type ApiCoverage = z.infer<typeof apiCoverageSchema>;
export type ApiDeposit = z.infer<typeof apiDepositSchema>;
export type ApiTransfer = z.infer<typeof apiTransferSchema>;
export type ApiPayoutRequest = z.infer<typeof apiPayoutRequestSchema>;
export type ApiPeriod = z.infer<typeof apiPeriodSchema>;
