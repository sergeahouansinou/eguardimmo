import { z } from "zod";
import { OWNER_ROLES } from "./model";

const role = z.enum(OWNER_ROLES);
const agency = z.object({ id: z.uuid(), name: z.string().nullable() });
const mandant = z.object({ name: z.string() });

export const agenciesSchema = z.object({
  data: z.array(
    z.object({
      access_id: z.uuid(),
      role,
      agency,
      mandant,
      access_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      in_grace: z.boolean(),
      read_only: z.boolean(),
    }),
  ),
});

export const linksSchema = z.object({
  data: z.array(z.object({ id: z.uuid(), role, organization: agency, mandant, linked_at: z.string().min(1) })),
});

export const meSchema = z.object({ data: z.object({ name: z.string().trim().min(1), email: z.email() }) });
