import { z } from "zod";
import { agencyRef, isoDate, isoInstant, moneySchema, pageOf, singleOf } from "../shared/schemas";

const money = moneySchema.nullable();

export const interventionSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  status: z.string(),
  priority: z.string(),
  nature: z.object({ key: z.string().nullable(), label: z.string().nullable() }),
  title: z.string(),
  agency: agencyRef,
  mandate_id: z.string().nullable(),
  place: z.object({ property_name: z.string().nullable(), unit_reference: z.string().nullable(), common_area: z.boolean() }),
  supplier: z.object({ name: z.string() }).nullable(),
  responsibility: z.string(),
  approval_basis: z.string().nullable(),
  estimated_amount: money,
  reported_on: isoDate,
  due_on: isoDate.nullable(),
  completed_on: isoDate.nullable(),
  closed_at: isoInstant.nullable(),
});

const quote = z.object({
  id: z.uuid(),
  reference: z.string().nullable(),
  kind: z.string(),
  status: z.string(),
  issued_on: isoDate,
  valid_until: isoDate.nullable(),
  proposed_on: isoDate.nullable(),
  total_net: money,
  total_tax: money,
  total_gross: money,
  lines: z.array(
    z.object({
      position: z.number().int(),
      label: z.string(),
      quantity_milli: z.number().int(),
      unit: z.string().nullable(),
      unit_price: moneySchema,
      net_amount: moneySchema,
      tax_rate_pcm: z.number().int(),
    }),
  ),
});

export const interventionDetailSchema = interventionSchema.extend({
  description: z.string().nullable(),
  emergency_reason: z.string().nullable(),
  visits: z.array(z.object({ id: z.uuid(), scheduled_on: isoDate, slot: z.string(), status: z.string() })),
  events: z.array(z.object({ id: z.uuid(), kind: z.string(), author: z.string(), text: z.string().nullable(), created_at: isoInstant })),
  files: z.array(z.object({ id: z.uuid(), kind: z.string(), name: z.string(), created_at: isoInstant.nullable() })),
  quotes: z.array(quote),
  approvals: z.array(
    z.object({
      id: z.uuid(),
      lock_version: z.number().int().min(1),
      quote_fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
      statement_version: z.string().nullable(),
      quote_id: z.string().nullable(),
      status: z.string(),
      amount: money,
      ceiling_amount: money,
      requested_at: isoInstant,
      decide_before: isoInstant,
      decided_at: isoInstant.nullable(),
      decided_via: z.string().nullable(),
      comment: z.string().nullable(),
    }),
  ),
  invoices: z.array(
    z.object({ id: z.uuid(), number: z.string().nullable(), status: z.string(), invoice_on: isoDate, due_on: isoDate.nullable(), total_net: money, total_tax: money, total_gross: money }),
  ),
  allocations: z.array(z.object({ id: z.uuid(), invoice_id: z.string(), charged_amount: money, created_at: isoInstant.nullable() })),
});

export const interventionPageSchema = pageOf(interventionSchema);
export const interventionResponseSchema = singleOf(interventionDetailSchema);

export const decisionResponseSchema = singleOf(
  z.object({
    id: z.uuid(),
    intervention_id: z.uuid(),
    status: z.string(),
    decided_at: isoInstant.nullable(),
    decided_via: z.string().nullable(),
    comment: z.string().nullable(),
    lock_version: z.number().int(),
    replayed: z.boolean(),
  }),
);
