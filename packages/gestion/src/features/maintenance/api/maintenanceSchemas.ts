import { z } from 'zod';
import {
  ACTOR_KINDS,
  ALLOCATION_TARGETS,
  APPROVAL_BASES,
  APPROVAL_STATUSES,
  DECIDED_VIA,
  DECLINE_REASONS,
  FILE_KINDS,
  INTERVENTION_STATUSES,
  ORIGINS,
  PAYMENT_METHODS,
  PRIORITIES,
  QUOTE_KINDS,
  QUOTE_STATUSES,
  REPORTED_URGENCIES,
  RESPONSIBILITIES,
  SUPPLIER_INVOICE_STATUSES,
  SUPPLIER_STATUSES,
  TAX_CATEGORIES,
  VISIT_SLOTS,
  VISIT_STATUSES,
} from '../model';

const id = z.guid();
const isoDate = z.iso.date();
const timestamp = z.iso.datetime({ offset: true });
const count = z.number().int().nonnegative();
const money = z.object({ amount: z.number().int(), currency: z.string().length(3) });
const committedMoney = z.object({ amount: z.number().int().nullable(), currency: z.string().length(3) });
const named = z.object({ id, name: z.string().nullable() }).nullable();

const eventSchema = z.object({
  id,
  kind: z.string(),
  actor_kind: z.enum(ACTOR_KINDS),
  text: z.string().nullable(),
  visible_to_owner: z.boolean(),
  visible_to_tenant: z.boolean(),
  created_at: timestamp,
});

export const apiFileSchema = z.object({
  id,
  kind: z.enum(FILE_KINDS),
  uploaded_by_kind: z.enum(ACTOR_KINDS),
  visible_to_owner: z.boolean(),
  visible_to_tenant: z.boolean(),
  created_at: timestamp.nullable(),
});

const visitSummarySchema = z.object({ id, scheduled_on: isoDate, slot: z.enum(VISIT_SLOTS), status: z.enum(VISIT_STATUSES) });

const visitSchema = z.object({
  id,
  supplier_party_id: id.nullable(),
  scheduled_on: isoDate,
  slot: z.enum(VISIT_SLOTS),
  presence_required: z.boolean(),
  status: z.enum(VISIT_STATUSES),
  requested_on: isoDate.nullable(),
  requested_slot: z.enum(VISIT_SLOTS).nullable(),
  contact_name: z.string().nullable(),
  contact_phone: z.string().nullable(),
  lock_version: count,
});

const quoteSchema = z.object({
  id,
  supplier_party_id: id.nullable(),
  reference: z.string(),
  kind: z.enum(QUOTE_KINDS),
  status: z.enum(QUOTE_STATUSES),
  issued_on: isoDate,
  valid_until: isoDate.nullable(),
  proposed_on: isoDate.nullable(),
  message: z.string().nullable(),
  total_net: money,
  total_tax: money,
  total_gross: money,
  lines: z
    .array(
      z.object({
        position: count,
        label: z.string(),
        quantity_milli: count,
        unit: z.string().nullable(),
        unit_price: z.number().int(),
        net_amount: z.number().int(),
        tax_category: z.enum(TAX_CATEGORIES),
        tax_rate_pcm: count,
      }),
    )
    .nullable(),
});

export const apiQuoteSummarySchema = z.object({
  id,
  intervention_id: id,
  supplier_party_id: id.nullable(),
  reference: z.string(),
  kind: z.enum(QUOTE_KINDS),
  status: z.enum(QUOTE_STATUSES),
  issued_on: isoDate,
  valid_until: isoDate.nullable(),
  proposed_on: isoDate.nullable(),
  message: z.string().nullable(),
  total_net: money,
  total_tax: money,
  total_gross: money,
  lock_version: count,
  intervention: z.object({ id, reference: z.string(), status: z.enum(INTERVENTION_STATUSES), unit_id: id.nullable() }).nullable(),
  approval: z.object({ status: z.enum(APPROVAL_STATUSES), ceiling_amount: money, decide_before: timestamp }).nullable(),
});

const approvalSchema = z.object({
  id,
  quote_id: id.nullable(),
  amount: money,
  ceiling_amount: money.nullable(),
  status: z.enum(APPROVAL_STATUSES),
  requested_at: timestamp,
  decide_before: timestamp,
  decided_at: timestamp.nullable(),
  decided_via: z.enum(DECIDED_VIA).nullable(),
  comment: z.string().nullable(),
  proof_file_id: id.nullable(),
  lock_version: count,
});

const allocationSchema = z.object({
  id,
  target: z.enum(ALLOCATION_TARGETS),
  share_amount: money,
  wear_basis_points: count.nullable(),
  charged_amount: money,
  basis_note: z.string().nullable(),
  cancelled_at: timestamp.nullable(),
});

const paymentSchema = z.object({
  id,
  amount: money,
  method: z.enum(PAYMENT_METHODS),
  paid_on: isoDate,
  reference: z.string().nullable(),
  cancelled_at: timestamp.nullable(),
});

const invoiceSchema = z.object({
  id,
  supplier_party_id: id.nullable(),
  number: z.string(),
  invoice_on: isoDate,
  due_on: isoDate.nullable(),
  total_net: money,
  total_tax: money,
  total_gross: money,
  status: z.enum(SUPPLIER_INVOICE_STATUSES),
  exceeds_approved_amount: z.boolean(),
  taxes: z.array(z.object({ category: z.enum(TAX_CATEGORIES), rate_pcm: count, base_amount: z.number().int(), tax_amount: z.number().int() })).nullable(),
  allocations: z.array(allocationSchema).nullable(),
  payments: z.array(paymentSchema).nullable(),
  lock_version: count,
});

const baseShape = {
  id,
  reference: z.string(),
  origin: z.enum(ORIGINS),
  status: z.enum(INTERVENTION_STATUSES),
  priority: z.enum(PRIORITIES),
  reported_urgency: z.enum(REPORTED_URGENCIES).nullable(),
  nature_term_id: id,
  title: z.string(),
  description: z.string(),
  room: z.string().nullable(),
  availability: z.string().nullable(),
  property_id: id.nullable(),
  unit_id: id.nullable(),
  unit: z.object({ id, reference: z.string(), property_name: z.string().nullable() }).nullable(),
  lease_id: id.nullable(),
  mandate_id: id.nullable(),
  mandant: named,
  reporter: named,
  supplier: named,
  responsibility: z.enum(RESPONSIBILITIES),
  reported_on: isoDate,
  due_on: isoDate.nullable(),
  estimated_amount: money.nullable(),
  ceiling_amount: money.nullable(),
  approval_basis: z.enum(APPROVAL_BASES).nullable(),
  emergency_reason: z.string().nullable(),
  decline_reason: z.enum(DECLINE_REASONS).nullable(),
  decline_note: z.string().nullable(),
  completed_on: isoDate.nullable(),
  completion_note: z.string().nullable(),
  closed_at: timestamp.nullable(),
  follows_intervention_id: id.nullable(),
  lock_version: count,
  created_at: timestamp.nullable(),
};

export const apiInterventionSchema = z.object({ ...baseShape, visits: z.array(visitSummarySchema) });

export const apiInterventionDetailSchema = z.object({
  ...baseShape,
  committed_amount: committedMoney,
  events: z.array(eventSchema),
  files: z.array(apiFileSchema),
  visits: z.array(visitSchema),
  quotes: z.array(quoteSchema),
  approvals: z.array(approvalSchema),
  invoices: z.array(invoiceSchema),
});

export const apiSupplierSchema = z.object({
  id,
  party: z.object({ id, name: z.string().nullable(), is_anonymized: z.boolean().nullable() }),
  status: z.enum(SUPPLIER_STATUSES),
  preferred: z.boolean(),
  payment_terms_days: count.nullable(),
  internal_note: z.string().nullable(),
  trade_term_ids: z.array(id),
  lock_version: count,
});

const cursorMeta = z.object({ per_page: count, next_cursor: z.string().nullable() });

export const apiInterventionPage = z.object({ data: z.array(apiInterventionSchema), meta: cursorMeta });
export const apiInterventionResponse = z.object({ data: apiInterventionDetailSchema });
export const apiQuotePage = z.object({ data: z.array(apiQuoteSummarySchema), meta: cursorMeta });
export const apiSupplierPage = z.object({ data: z.array(apiSupplierSchema), meta: cursorMeta });
export const apiSupplierResponse = z.object({ data: apiSupplierSchema });
export const apiFileResponse = z.object({ data: apiFileSchema });
export const apiAck = z.object({ data: z.object({ id }) });
export const apiReplayable = z.object({ data: z.object({ id, replayed: z.boolean().nullable() }) });

export const apiUnitPage = z.object({
  data: z.array(z.object({ id, reference: z.string(), property: z.object({ id, name: z.string() }).nullable() })),
  meta: cursorMeta,
});

export const apiPartyPage = z.object({
  data: z.array(z.object({ id, display_name: z.string(), is_anonymized: z.boolean(), archived_at: timestamp.nullable() })),
  meta: cursorMeta,
});

export const apiTerms = z.object({
  data: z.array(
    z.object({
      id,
      key: z.string(),
      labels: z.record(z.string(), z.string()),
      archived: z.boolean(),
      hidden: z.boolean(),
      metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    }),
  ),
});

export type ApiIntervention = z.infer<typeof apiInterventionSchema>;
export type ApiInterventionDetail = z.infer<typeof apiInterventionDetailSchema>;
export type ApiQuoteSummary = z.infer<typeof apiQuoteSummarySchema>;
export type ApiSupplier = z.infer<typeof apiSupplierSchema>;
export type ApiFile = z.infer<typeof apiFileSchema>;
export type ApiTerms = z.infer<typeof apiTerms>;
