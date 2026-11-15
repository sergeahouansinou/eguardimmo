import { z } from 'zod';
import { TRANSMISSION_DUREES } from '../schemas';

export const selectionSchema = z.array(z.string().min(1)).min(1, 'Sélectionnez au moins une créance.');

export const transmitFormSchema = z.object({
  contactId: z.string().min(1, 'Choisissez le commissaire de justice.'),
  dureeJours: z
    .string()
    .refine((value) => TRANSMISSION_DUREES.some((duree) => String(duree) === value), 'Choisissez une durée de validité.')
    .transform(Number),
  message: z.string().trim().max(500, 'Le message ne dépasse pas 500 caractères.'),
});
export type TransmitFormValues = z.output<typeof transmitFormSchema>;
