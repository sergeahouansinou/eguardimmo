import { z } from "zod";
import { OWNER_ROLES } from "../model";
import { isoDate, isoInstant, singleOf } from "../shared/schemas";

export const payoutRequestSchema = z.object({
  id: z.uuid(),
  access_id: z.uuid(),
  status: z.string(),
  bank_last4: z.string().nullable(),
  holder_name: z.string().nullable(),
  requested_at: isoInstant.nullable(),
  code_expires_at: isoInstant.nullable(),
  decided_at: isoInstant.nullable(),
});

const accountSchema = z.object({
  access_id: z.uuid(),
  agency_id: z.uuid(),
  agency_name: z.string().nullable(),
  mandant_name: z.string(),
  role: z.enum(OWNER_ROLES),
  can_request: z.boolean(),
  current: z.object({ bank_last4: z.string(), active_since: isoDate }).nullable(),
  cooling_until: isoDate.nullable(),
  contested: z.boolean(),
  request: payoutRequestSchema.nullable(),
});

export const payoutAccountsSchema = z.object({ data: z.array(accountSchema) });
export const payoutRequestResponseSchema = singleOf(payoutRequestSchema);
export const contestResponseSchema = singleOf(z.object({ access_id: z.uuid(), contested: z.boolean(), contested_at: isoInstant.nullable() }));
