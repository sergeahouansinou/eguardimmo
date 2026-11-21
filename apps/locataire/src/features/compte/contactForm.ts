import { z } from 'zod';
import { CONTACT_FIELDS } from '@/tenant/accountSchemas';

export const contactFormSchema = z.object({
  organizationId: z.uuid('Choisissez une agence.'),
  fields: z.array(z.enum(CONTACT_FIELDS)).min(1, 'Cochez au moins une coordonnée à transmettre.'),
});

export type ContactValues = z.input<typeof contactFormSchema>;
