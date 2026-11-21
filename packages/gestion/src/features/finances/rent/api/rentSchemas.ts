import { z } from 'zod';
import { INSTALLMENT_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, RECEIPT_STATES } from '../model';

const id = z.guid();
const isoDate = z.iso.date();
const count = z.number().int().nonnegative();

export const apiMoneySchema = z.object({ amount: z.number().int(), currency: z.string().length(3) });
const money = apiMoneySchema;

const apiLineSchema = z.object({
  id,
  label: z.string(),
  component_key: z.string(),
  semantic: z.string().nullable(),
  from: isoDate,
  to: isoDate,
  days: count,
  month_days: count,
  monthly_amount: money,
  amount: money,
  vat_bp: count,
  vat_amount: money,
});

export const apiInstallmentSchema = z.object({
  id,
  lease: z.object({ id, reference: z.string().nullable() }),
  party_id: id,
  unit_id: id,
  period: z.object({ start: isoDate, end: isoDate }),
  due_date: isoDate,
  status: z.enum(INSTALLMENT_STATUSES),
  is_overdue: z.boolean(),
  amounts: z.object({ rent: money, charges: money, vat: money, total: money }),
  outstanding: money.nullable(),
  issued_on: isoDate.nullable(),
  cancelled_on: isoDate.nullable(),
  cancellation_reason: z.string().nullable(),
  notice: z.object({ id, number: z.string(), issued_on: isoDate, fingerprint: z.string() }).nullable(),
  receipt: z.object({ id, number: z.string(), issued_on: isoDate }).nullable(),
  receipt_state: z.enum(RECEIPT_STATES),
  lines: z.array(apiLineSchema).optional(),
});

export const apiPaymentSchema = z.object({
  id,
  lease_id: id,
  party_id: id,
  status: z.enum(PAYMENT_STATUSES),
  method: z.enum(PAYMENT_METHODS),
  amount: money,
  received_on: isoDate,
  reference: z.string().nullable(),
  note: z.string().nullable(),
  cancelled_on: isoDate.nullable(),
  cancellation_reason: z.string().nullable(),
  recorded_at: z.iso.datetime({ offset: true }).nullable(),
  allocations: z.array(z.object({ installment_id: id, amount: money })).nullable(),
  advance: money.nullable(),
  replayed: z.boolean().nullable(),
  receipts: z.record(z.string(), z.enum(RECEIPT_STATES)).nullable(),
});

export const apiBalanceSchema = z.object({
  lease_id: id,
  balance: money,
  overdue: money,
  advance: money,
  unpaid_count: count,
  oldest_unpaid_due_date: isoDate.nullable(),
});

const apiSnapshotSchema = z.object({
  issuer: z.object({ name: z.string() }).optional(),
  paid_on: isoDate.nullable().optional(),
  currency: z.string().length(3),
  lines: z.array(z.object({ label: z.string(), from: isoDate, to: isoDate, amount: z.number().int() })),
  payments: z.array(z.object({ received_on: isoDate, method: z.enum(PAYMENT_METHODS), amount: z.number().int() })),
  mention: z.string().nullable().optional(),
});

export const apiReceiptSchema = z.object({
  id,
  number: z.string(),
  lease: z.object({ id, reference: z.string().optional() }),
  installment_id: id,
  tenants: z.array(z.string()),
  unit: z
    .object({
      reference: z.string(),
      property_name: z.string().nullable().optional(),
      address: z.object({ line1: z.string().nullable().optional(), postal_code: z.string().nullable().optional(), city: z.string().nullable().optional() }).nullable().optional(),
    })
    .nullable(),
  period: z.object({ start: isoDate, end: isoDate, due_date: isoDate }).nullable(),
  amounts: z.object({ rent: money, charges: money, vat: money, total: money }),
  issued_on: isoDate,
  fingerprint: z.string(),
  is_void: z.boolean(),
  voided_at: z.string().nullable(),
  void_reason: z.string().nullable(),
  snapshot: apiSnapshotSchema.nullable(),
});

const pageMeta = z.object({ per_page: count, next_cursor: z.string().nullable() });

export const apiInstallmentResponse = z.object({ data: apiInstallmentSchema });
export const apiInstallmentPage = z.object({ data: z.array(apiInstallmentSchema), meta: pageMeta });
export const apiPaymentResponse = z.object({ data: apiPaymentSchema });
export const apiPaymentPage = z.object({ data: z.array(apiPaymentSchema), meta: pageMeta });
export const apiBalanceResponse = z.object({ data: apiBalanceSchema });
export const apiReceiptResponse = z.object({ data: apiReceiptSchema });
export const apiReceiptPage = z.object({ data: z.array(apiReceiptSchema), meta: pageMeta });
export const apiGenerationResponse = z.object({ data: z.object({ created: count, existing: count }) });
export const apiBatchResponse = z.object({
  data: z.object({ issued: count, failed: z.array(z.object({ installment_id: id })), remaining: z.boolean() }),
});

export type ApiInstallment = z.infer<typeof apiInstallmentSchema>;
export type ApiPayment = z.infer<typeof apiPaymentSchema>;
export type ApiBalance = z.infer<typeof apiBalanceSchema>;
export type ApiReceipt = z.infer<typeof apiReceiptSchema>;
