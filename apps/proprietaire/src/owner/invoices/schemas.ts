import { z } from "zod";
import { agencyRef, isoDate, moneySchema, pageOf, singleOf } from "../shared/schemas";

export const invoiceSchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  status: z.string(),
  number: z.string().nullable(),
  agency: agencyRef,
  mandate_id: z.string().nullable(),
  credited_invoice_id: z.string().nullable(),
  issued_on: isoDate.nullable(),
  due_on: isoDate.nullable(),
  service_from: isoDate.nullable(),
  service_to: isoDate.nullable(),
  currency: z.string(),
  total_net: moneySchema,
  total_tax: moneySchema,
  total_gross: moneySchema,
  has_pdf: z.boolean(),
});

export const invoiceDetailSchema = invoiceSchema.extend({
  lines: z.array(
    z.object({
      position: z.number().int(),
      description: z.string(),
      quantity_milli: z.number().int(),
      unit_price: moneySchema,
      net_amount: moneySchema,
      tax_category: z.string(),
      tax_rate_pcm: z.number().int(),
    }),
  ),
  taxes: z.array(z.object({ category: z.string(), rate_pcm: z.number().int(), base_amount: moneySchema, tax_amount: moneySchema })),
});

export const invoicePageSchema = pageOf(invoiceSchema);
export const invoiceResponseSchema = singleOf(invoiceDetailSchema);
