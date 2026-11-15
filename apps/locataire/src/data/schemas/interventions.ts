import { z } from 'zod';
import { isoDate, isoDateTime, requiredText } from './common';

export const INTERVENTION_TYPES = [
  { value: 'plomberie', label: 'Plomberie, fuite' },
  { value: 'electricite', label: 'Électricité' },
  { value: 'chauffage', label: 'Chauffage, eau chaude' },
  { value: 'serrurerie', label: 'Serrurerie, porte' },
  { value: 'humidite', label: 'Humidité, moisissures' },
  { value: 'nuisibles', label: 'Nuisibles' },
  { value: 'autre', label: 'Autre problème' },
] as const;

export const INTERVENTION_ROOMS = [
  'Cuisine',
  'Séjour',
  'Chambre 1',
  'Chambre 2',
  'Salle de bains et WC',
  'Entrée',
  'Parties communes',
] as const;

export const URGENCIES = [
  { value: 'urgente', label: 'Urgent', detail: 'Risque de dégât important' },
  { value: 'rapide', label: 'À traiter rapidement', detail: 'Sous quelques jours' },
  { value: 'normale', label: 'Peut attendre', detail: 'Sans gêne immédiate' },
] as const;

export const interventionSchema = z.object({
  id: z.string().regex(/^INT-\d{4}-\d{4}$/),
  title: z.string(),
  typeLabel: z.string(),
  room: z.string(),
  description: z.string(),
  urgency: z.enum(['urgente', 'rapide', 'normale']),
  status: z.enum(['signalee', 'en_cours', 'terminee']),
  reportedAt: isoDateTime,
  photos: z.array(z.string()),
  availability: z.string(),
  appointment: z
    .object({ date: isoDate, slot: z.string(), contractor: z.string(), phone: z.string(), presenceRequired: z.boolean() })
    .nullable(),
  mandatedOn: isoDate.nullable(),
  timeline: z.array(
    z.object({
      label: z.string(),
      detail: z.string(),
      state: z.enum(['done', 'next', 'todo']),
    }),
  ),
});
export type Intervention = z.infer<typeof interventionSchema>;

export const interventionInputSchema = z.object({
  type: z.string().min(1, 'Choisissez un type de problème.'),
  room: z.string().min(1, 'Choisissez la pièce concernée.'),
  title: requiredText('Le titre', 100),
  description: requiredText('La description', 1000),
  urgency: z.enum(['urgente', 'rapide', 'normale']),
  availability: z.string().trim().max(200, 'Les disponibilités sont trop longues.'),
  photos: z.array(z.string().max(160)).max(6, 'Six photos au maximum.'),
});
export type InterventionInput = z.infer<typeof interventionInputSchema>;

export const SLOTS = ['9 h à 12 h', '14 h à 17 h', '17 h à 19 h'] as const;

export const rescheduleInputSchema = z.object({
  id: z.string(),
  date: isoDate,
  slot: z.enum(SLOTS, { error: 'Choisissez un créneau.' }),
});
export type RescheduleInput = z.infer<typeof rescheduleInputSchema>;
