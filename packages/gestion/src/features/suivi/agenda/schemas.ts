import { z } from 'zod';
import { BIEN_IDS } from '../shared/biens';
import { isoDateSchema } from '../shared/schemas';

export const EVENT_KINDS = ['visite', 'rendez_vous', 'echeance', 'intervention', 'rappel', 'contrat', 'anniversaire'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const kindLabels: Record<EventKind, string> = {
  visite: 'Visite',
  rendez_vous: 'Rendez-vous',
  echeance: 'Échéance',
  intervention: 'Intervention',
  rappel: 'Rappel',
  contrat: 'Contrat ou diagnostic',
  anniversaire: 'Anniversaire',
};

export const RECURRENCES = ['aucune', 'hebdomadaire', 'mensuelle', 'annuelle'] as const;
export type Recurrence = (typeof RECURRENCES)[number];

export const recurrenceLabels: Record<Recurrence, string> = {
  aucune: 'Ne se répète pas',
  hebdomadaire: 'Chaque semaine',
  mensuelle: 'Chaque mois',
  annuelle: 'Chaque année',
};

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Indiquez une heure valide, par exemple 15:30.');

export const eventInputSchema = z.object({
  title: z.string().trim().min(1, 'Indiquez le titre de l’événement.').max(120, 'Le titre ne dépasse pas 120 caractères.'),
  kind: z.enum(EVENT_KINDS, { error: 'Choisissez un type d’événement.' }),
  date: isoDateSchema,
  time: timeSchema.nullable(),
  bienId: z.enum(BIEN_IDS).nullable(),
  recurrence: z.enum(RECURRENCES),
  invitees: z.array(z.string().trim().min(1).max(80, 'Un nom ne dépasse pas 80 caractères.')).max(20, '20 personnes invitées au maximum.'),
  notes: z.string().trim().max(1000, 'Les notes ne dépassent pas 1 000 caractères.'),
  reminder: z.boolean(),
});
export type EventInput = z.infer<typeof eventInputSchema>;

export const eventSchema = eventInputSchema.extend({ id: z.string().min(1) });
export type AgendaEvent = z.infer<typeof eventSchema>;
export const eventListSchema = z.array(eventSchema);

export const echeanceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  detail: z.string(),
  date: isoDateSchema,
  time: timeSchema.nullable(),
  bienId: z.enum(BIEN_IDS).nullable(),
});
export type Echeance = z.infer<typeof echeanceSchema>;
export const echeanceListSchema = z.array(echeanceSchema);
