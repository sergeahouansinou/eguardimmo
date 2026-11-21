import { z } from "zod";
import { address, agencyRef, mandantRef, pageOf, singleOf } from "../shared/schemas";

export const unitSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  type: z.string(),
  floor: z.number().int().nullable(),
  surface_hundredths: z.number().int().nullable(),
  property: z.object({ name: z.string(), address }),
  agency: agencyRef,
  mandant: mandantRef,
  covered_from: z.string().nullable(),
  covered_until: z.string().nullable(),
});

export const unitPageSchema = pageOf(unitSchema);
export const unitDetailSchema = singleOf(unitSchema);
