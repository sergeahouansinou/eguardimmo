import { z } from 'zod';
import { BIEN_IDS, INTERVENANTS } from '../shared/biens';
import { fileMetaSchema, isoDateSchema } from '../shared/schemas';

export const PRIORITIES = ['urgente', 'normale', 'basse'] as const;
export const STATUSES = ['ouverte', 'en_cours', 'terminee'] as const;

export type Priority = (typeof PRIORITIES)[number];
export type InterventionStatus = (typeof STATUSES)[number];

export const priorityLabels: Record<Priority, string> = { urgente: 'Urgente', normale: 'Normale', basse: 'Basse' };
export const statusLabels: Record<InterventionStatus, string> = {
  ouverte: 'Ouverte',
  en_cours: 'En cours',
  terminee: 'Terminée',
};

export const interventionInputSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, 'Indiquez le sujet de l’intervention.')
    .max(120, 'Le sujet ne dépasse pas 120 caractères.'),
  bienId: z.enum(BIEN_IDS, { error: 'Choisissez le bien concerné.' }),
  priority: z.enum(PRIORITIES, { error: 'Choisissez une priorité.' }),
  dueDate: isoDateSchema.nullable(),
  intervenant: z.enum(INTERVENANTS).nullable(),
  description: z.string().trim().max(1000, 'La description ne dépasse pas 1 000 caractères.'),
  notifyTenant: z.boolean(),
  photos: z.array(fileMetaSchema).max(10, '10 photos au maximum.'),
});
export type InterventionInput = z.infer<typeof interventionInputSchema>;

export const interventionSchema = interventionInputSchema.extend({
  id: z.string().min(1),
  status: z.enum(STATUSES),
  updatedAt: isoDateSchema,
  archived: z.boolean(),
});
export type Intervention = z.infer<typeof interventionSchema>;

export const interventionListSchema = z.array(interventionSchema);
