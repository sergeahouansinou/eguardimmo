import { z } from 'zod';
import { addressSchema, isoDate, moneySchema } from './schemas';

const leaseRef = z.object({ id: z.uuid(), reference: z.string().nullable() });
const amounts = z.object({ rent: moneySchema, charges: moneySchema, vat: moneySchema, total: moneySchema });
const cursorMeta = z.object({ next_cursor: z.string().nullable() });

const line = z.object({
  label: z.string(),
  from: isoDate,
  to: isoDate,
  days: z.number().int().positive(),
  month_days: z.number().int().positive(),
  amount: moneySchema,
  vat_bp: z.number().int().nonnegative(),
  vat_amount: moneySchema,
});

const installment = z.object({
  id: z.uuid(),
  lease: leaseRef,
  period: z.object({ start: isoDate, end: isoDate }),
  due_date: isoDate,
  status: z.enum(['issued', 'partially_paid', 'paid']),
  is_overdue: z.boolean(),
  amounts,
  outstanding: moneySchema.nullable(),
  issued_on: isoDate.nullable(),
  notice: z.object({ number: z.string(), issued_on: isoDate }).nullable(),
  receipt: z.object({ id: z.uuid(), number: z.string(), issued_on: isoDate }).nullable(),
  lines: z.array(line).optional(),
});
export type ApiInstallment = z.infer<typeof installment>;

export const installmentPageSchema = z.object({ data: z.array(installment), meta: cursorMeta });
export const installmentSchema = z.object({ data: installment });

const receipt = z.object({
  id: z.uuid(),
  number: z.string(),
  lease: leaseRef,
  installment_id: z.uuid().nullable(),
  issuer: z.string().nullable(),
  tenants: z.array(z.string()),
  unit: z
    .object({ reference: z.string().nullable(), property_name: z.string().nullable(), address: addressSchema.nullable() })
    .nullable(),
  period: z.object({ start: isoDate.nullable(), end: isoDate.nullable() }).nullable(),
  amounts,
  issued_on: isoDate,
  is_void: z.boolean(),
  voided_at: z.iso.datetime({ offset: true }).nullable(),
  paid_on: isoDate.nullable(),
});
export type ApiReceipt = z.infer<typeof receipt>;

export const receiptPageSchema = z.object({ data: z.array(receipt), meta: cursorMeta });
export const receiptSchema = z.object({ data: receipt });

const payment = z.object({
  id: z.uuid(),
  lease: leaseRef,
  status: z.enum(['recorded', 'cancelled']),
  method: z.enum(['transfer', 'cheque', 'cash', 'direct_debit']),
  amount: moneySchema,
  received_on: isoDate,
  cancelled_on: isoDate.nullable(),
  allocations: z.array(z.object({ installment_id: z.uuid(), amount: moneySchema })).nullable(),
});
export type ApiPayment = z.infer<typeof payment>;

export const paymentPageSchema = z.object({ data: z.array(payment), meta: cursorMeta });
export const paymentSchema = z.object({ data: payment });
