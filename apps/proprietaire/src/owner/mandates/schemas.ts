import { z } from "zod";
import { agencyRef, isoDate, isoInstant, mandantRef, moneySchema, pageOf, singleOf } from "../shared/schemas";

export const endRequestSchema = z.object({
  id: z.uuid(),
  mandate_id: z.uuid(),
  status: z.string(),
  reason: z.string().nullable(),
  requested_at: isoInstant,
  cancelled_at: isoInstant.nullable(),
});

const termsSchema = z.object({
  fee_kind: z.string(),
  fee_basis_points: z.number().int().nullable(),
  fee_flat_amount: moneySchema.nullable(),
  fee_base: z.string().nullable(),
  fee_minimum_amount: moneySchema.nullable(),
  fee_tax_mode: z.string(),
  payout_day: z.number().int(),
  valid_from: isoDate,
});

export const mandateSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  status: z.string(),
  type: z.object({ key: z.string(), label: z.string() }),
  agency: agencyRef,
  mandant: mandantRef,
  starts_on: isoDate,
  end_date: isoDate.nullable(),
  tacit_renewal: z.boolean(),
  renewal_months: z.number().int().nullable(),
  notice_months: z.number().int().nullable(),
  currency: z.string(),
  signed_on: isoDate.nullable(),
  notice_given_on: isoDate.nullable(),
  end_request: endRequestSchema.nullable(),
  terms: termsSchema.nullable(),
  units: z.array(
    z.object({
      id: z.uuid(),
      reference: z.string().nullable(),
      property_name: z.string().nullable(),
      valid_from: isoDate,
      end_date: isoDate.nullable(),
    }),
  ),
});

export const mandatePageSchema = pageOf(mandateSchema);
export const mandateResponseSchema = singleOf(mandateSchema);
export const endRequestResponseSchema = singleOf(endRequestSchema);
