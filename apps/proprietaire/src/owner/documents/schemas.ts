import { z } from "zod";
import { agencyRef, isoInstant, mandantRef, pageOf } from "../shared/schemas";

export const documentSchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  name: z.string().nullable(),
  mime_type: z.string().nullable(),
  size_bytes: z.number().int().nonnegative().nullable(),
  shared_at: isoInstant.nullable(),
  uploaded_by: z.string(),
  mandate: z.object({ reference: z.string().nullable() }),
  agency: agencyRef,
  mandant: mandantRef,
});

export const documentPageSchema = pageOf(documentSchema);
