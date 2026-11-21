import { z } from 'zod';
import { MAX_NOTE_LENGTH, REJECTION_REASONS } from './model';

export const rejectSchema = z.object({
  reason: z.enum(REJECTION_REASONS, 'Choisissez le motif du refus.'),
  note: z.string().trim().max(MAX_NOTE_LENGTH, `La note ne peut pas dépasser ${String(MAX_NOTE_LENGTH)} caractères.`),
});
export type RejectValues = z.input<typeof rejectSchema>;
export type RejectInput = z.output<typeof rejectSchema>;

export const insuranceFilterSchema = z.enum(['pending', 'accepted', 'rejected', 'withdrawn']).nullable();
