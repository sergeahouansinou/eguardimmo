import { z } from 'zod';
import { INVOICE_KINDS, INVOICE_STATUSES, PAYMENT_METHODS, TAX_CATEGORIES, TAX_CODES } from '../model';

const id = z.guid();
const isoDate = z.iso.date();
const timestamp = z.iso.datetime({ offset: true });
const count = z.number().int().nonnegative();
const money = z.object({ amount: z.number().int(), currency: z.string().length(3) });

const apiLineSchema = z.object({
  id,
  position: count,
  item_term_id: id,
  description: z.string(),
  quantity_milli: count,
  unit_price: z.number().int(),
  net_amount: z.number().int(),
  tax_category: z.enum(TAX_CATEGORIES),
  tax_rate_pcm: count,
  credited_line_id: id.nullable(),
});

const apiTaxSchema = z.object({
  tax_code: z.enum(TAX_CODES),
  category: z.enum(TAX_CATEGORIES),
  rate_pcm: count,
  base_amount: z.number().int(),
  tax_amount: z.number().int(),
});

export const apiPaymentSchema = z.object({
  id,
  invoice_id: id,
  amount: money,
  method: z.enum(PAYMENT_METHODS),
  paid_on: isoDate,
  reference: z.string().nullable(),
  cancelled_at: timestamp.nullable(),
  recorded_at: timestamp.nullable(),
  replayed: z.boolean().nullable(),
});

export const apiInvoiceSchema = z.object({
  id,
  kind: z.enum(INVOICE_KINDS),
  status: z.enum(INVOICE_STATUSES),
  number: z.string().nullable(),
  credited_invoice_id: id.nullable(),
  issued_on: isoDate.nullable(),
  due_on: isoDate.nullable(),
  service_from: isoDate.nullable(),
  service_to: isoDate.nullable(),
  recipient_party_id: id,
  lease_id: id.nullable(),
  mandate_id: id.nullable(),
  currency: z.string().length(3),
  total_net: money,
  total_tax: money,
  total_gross: money,
  outstanding: money.nullable(),
  credit_reason: z.string().nullable(),
  lock_version: count,
  overdue_flagged_at: timestamp.nullable(),
  sent_at: timestamp.nullable(),
  created_at: timestamp.nullable(),
  lines: z.array(apiLineSchema).nullable(),
  taxes: z.array(apiTaxSchema).nullable(),
  payments: z.array(apiPaymentSchema).nullable(),
  replayed: z.boolean().nullable(),
});

const cursorMeta = z.object({ per_page: count, next_cursor: z.string().nullable() });

export const apiInvoiceResponse = z.object({ data: apiInvoiceSchema });
export const apiInvoicePage = z.object({ data: z.array(apiInvoiceSchema), meta: cursorMeta });
export const apiPaymentResponse = z.object({ data: apiPaymentSchema });

export const apiPartyPage = z.object({
  data: z.array(z.object({ id, display_name: z.string(), primary_email: z.string().nullable(), is_anonymized: z.boolean(), archived_at: timestamp.nullable() })),
  meta: cursorMeta,
});

export const apiItemTerms = z.object({
  data: z.array(z.object({ id, labels: z.record(z.string(), z.string()), key: z.string(), semantic_key: z.string().nullable(), archived: z.boolean(), hidden: z.boolean() })),
});

export type ApiInvoice = z.infer<typeof apiInvoiceSchema>;
export type ApiPayment = z.infer<typeof apiPaymentSchema>;
export type ApiPartyPage = z.infer<typeof apiPartyPage>;
