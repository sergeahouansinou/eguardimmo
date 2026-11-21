import { z } from 'zod';
import { MANUAL_ACT_TYPES } from './model';
import type { ManualActType } from './model';

export const actFormSchema = z.object({
  type: z.string().refine((value): value is ManualActType => MANUAL_ACT_TYPES.some((type) => type === value), 'Choisissez le type d’acte.'),
  performedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Indiquez la date de l’acte.'),
  note: z.string().trim().max(500, 'La note ne dépasse pas 500 caractères.'),
  reference: z.string().trim().max(120, 'La référence ne dépasse pas 120 caractères.'),
});

export const transmitFormSchema = z.object({
  recipientPartyId: z.string().min(1, 'Choisissez le commissaire de justice.'),
  validDays: z.string().min(1, 'Choisissez une durée de validité.'),
});

export const VALIDITY_CHOICES = [1, 3, 7, 14, 21, 30] as const;
