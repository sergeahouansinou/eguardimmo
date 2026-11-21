import { z } from "zod";
import { address, agencyRef, isoDate, mandantRef, moneySchema, pageOf, singleOf } from "../shared/schemas";

export const leaseUnitSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  type: z.string(),
  floor: z.number().int().nullable(),
  surface_hundredths: z.number().int().nullable(),
  property: z.object({ name: z.string(), address }),
});

const tenantSchema = z.object({ display_name: z.string(), role: z.string(), valid_from: isoDate, end_date: isoDate.nullable() });

export const leaseSchema = z.object({
  id: z.uuid(),
  reference: z.string().nullable(),
  status: z.string(),
  phase: z.string(),
  starts_on: isoDate,
  end_date: isoDate.nullable(),
  agency: agencyRef,
  mandant: mandantRef,
  main_unit: leaseUnitSchema.nullable(),
  tenants: z.array(tenantSchema),
});

export const leaseDetailSchema = leaseSchema.extend({
  duration_months: z.number().int().nullable(),
  tacit_renewal: z.boolean(),
  periodicity: z.string(),
  billing_timing: z.string(),
  due_day: z.number().int().nullable(),
  currency: z.string(),
  signed_on: isoDate.nullable(),
  notice: z.object({ received_on: isoDate, given_by: z.string().nullable(), departure_on: isoDate.nullable() }).nullable(),
  units: z.array(z.object({ unit: leaseUnitSchema.nullable(), is_main: z.boolean(), valid_from: isoDate, end_date: isoDate.nullable() })),
  terms_on: isoDate,
  terms: z.array(
    z.object({
      component: z.object({ key: z.string(), label: z.string(), semantic_key: z.string().nullable() }).nullable(),
      amount: moneySchema,
      vat_bp: z.number().int(),
      indexed: z.boolean(),
      valid_from: isoDate,
      end_date: isoDate.nullable(),
    }),
  ),
});

export const leasePageSchema = pageOf(leaseSchema);
export const leaseResponseSchema = singleOf(leaseDetailSchema);
