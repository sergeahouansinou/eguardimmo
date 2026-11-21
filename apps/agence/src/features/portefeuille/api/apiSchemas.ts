import { z } from "zod";

const id = z.guid();
const isoDate = z.iso.date();
const timestamp = z.iso.datetime({ offset: true });

const money = z.object({ amount: z.number().int().nonnegative(), currency: z.string().length(3) });

export const MANDATE_STATUSES = ["draft", "active", "suspended", "terminated", "expired"] as const;
export const mandateStatusSchema = z.enum(MANDATE_STATUSES);
export type ApiMandateStatus = z.infer<typeof mandateStatusSchema>;

export const feeKindSchema = z.enum(["percentage", "flat"]);
export type ApiFeeKind = z.infer<typeof feeKindSchema>;

export const feeBaseSchema = z.enum(["rent", "rent_and_charges"]);
export type ApiFeeBase = z.infer<typeof feeBaseSchema>;

export const feeTaxModeSchema = z.enum(["excl_tax", "incl_tax"]);
export type ApiFeeTaxMode = z.infer<typeof feeTaxModeSchema>;

const partyRef = z.object({ id, display_name: z.string(), kind: z.enum(["person", "company"]), is_anonymized: z.boolean() });
const unitRef = z.object({ id, reference: z.string(), property: z.object({ id, name: z.string() }) });

export const apiMandateUnitSchema = z.object({
  id,
  unit: unitRef.nullable(),
  valid_from: isoDate,
  end_date: isoDate.nullable(),
});
export type ApiMandateUnit = z.infer<typeof apiMandateUnitSchema>;

export const apiMandateTermsSchema = z.object({
  id,
  fee_kind: feeKindSchema,
  fee_basis_points: z.number().int().min(0).max(10_000).nullable(),
  fee_flat_amount: money.nullable(),
  payout_day: z.number().int().min(1).max(28),
  works_limit_amount: money,
  fee_base: feeBaseSchema.nullable(),
  fee_minimum_amount: money,
  fee_tax_mode: feeTaxModeSchema,
  letting_fee_basis_points: z.number().int().min(0).max(10_000).nullable(),
  works_fee_basis_points: z.number().int().min(0).max(10_000).nullable(),
  signed_file_id: id.nullable(),
  valid_from: isoDate,
  valid_to: isoDate.nullable(),
  reason: z.enum(["initial", "amendment"]),
});
export type ApiMandateTerms = z.infer<typeof apiMandateTermsSchema>;

export const apiMandateSummarySchema = z.object({
  id,
  reference: z.string(),
  status: mandateStatusSchema,
  mandant: partyRef,
  mandate_type: z.object({ id, key: z.string(), label: z.string(), semantic_key: z.string().nullable() }),
  starts_on: isoDate,
  end_date: isoDate,
  tacit_renewal: z.boolean(),
  currency: z.string().length(3),
  units: z.array(apiMandateUnitSchema),
  terms: apiMandateTermsSchema.nullable(),
  lock_version: z.number().int().positive(),
  archived_at: timestamp.nullable(),
  has_end_request: z.boolean(),
});
export type ApiMandateSummary = z.infer<typeof apiMandateSummarySchema>;

export const apiMandateDetailSchema = apiMandateSummarySchema.extend({
  renewal_months: z.number().int().min(1),
  notice_months: z.number().int().min(0),
  signed_on: isoDate.nullable(),
  signed_file_id: id.nullable(),
  termination: z
    .object({ notice_given_on: isoDate.nullable(), effective_on: isoDate.nullable(), reason: z.string(), note: z.string().nullable() })
    .nullable(),
  note: z.string().nullable(),
  custom_fields: z.unknown(),
  terms_history: z.array(apiMandateTermsSchema),
});
export type ApiMandateDetail = z.infer<typeof apiMandateDetailSchema>;

const pageMeta = z.object({ per_page: z.number().int().nonnegative(), next_cursor: z.string().nullable() });

export const apiMandatePageSchema = z.object({ data: z.array(apiMandateSummarySchema), meta: pageMeta });
export const apiMandateResponseSchema = z.object({ data: apiMandateDetailSchema });

export const apiMandantSchema = z.object({
  party_id: id,
  display_name: z.string(),
  mandate_count: z.number().int().nonnegative(),
  running_mandate_count: z.number().int().nonnegative(),
});
export type ApiMandant = z.infer<typeof apiMandantSchema>;
export const apiMandantListSchema = z.object({ data: z.array(apiMandantSchema) });

export const apiPartyPageSchema = z.object({
  data: z.array(z.object({ id, kind: z.enum(["person", "company"]), display_name: z.string(), is_anonymized: z.boolean(), archived_at: timestamp.nullable() })),
  meta: pageMeta,
});
export const apiUnitPageSchema = z.object({
  data: z.array(z.object({ id, reference: z.string(), property: z.object({ id, name: z.string() }), archived_at: timestamp.nullable() })),
  meta: pageMeta,
});
export const apiTermListSchema = z.object({
  data: z.array(z.object({ id, key: z.string(), labels: z.record(z.string(), z.string()), semantic_key: z.string().nullable(), archived: z.boolean() })),
});

export const END_REQUEST_STATUSES = ["pending", "dismissed", "fulfilled", "cancelled"] as const;

const apiEndRequestSchema = z.object({
  id,
  mandate_id: id,
  status: z.enum(END_REQUEST_STATUSES),
  reason: z.string().nullable(),
  requested_at: timestamp,
  cancelled_at: timestamp.nullable(),
  decided_at: timestamp.nullable(),
  decision_note: z.string().nullable(),
});

export const apiEndRequestResponseSchema = z.object({ data: apiEndRequestSchema.nullable() });
export const apiEndRequestDismissedSchema = z.object({ data: apiEndRequestSchema.extend({ status: z.literal("dismissed") }) });
export type ApiEndRequest = z.infer<typeof apiEndRequestSchema>;
