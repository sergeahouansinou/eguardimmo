import { z } from 'zod';
import { requiredDate } from '../shared/dates';

export const acknowledgeSchema = z.object({ receivedOn: requiredDate('Date de réception') });
export type AcknowledgeValues = z.input<typeof acknowledgeSchema>;

export const leaseNoticeSchema = z.object({
  receivedOn: requiredDate('Date de réception'),
  departureOn: z.string().refine((value) => value === '' || z.iso.date().safeParse(value).success, 'Date de départ : indiquez une date valide.'),
  reason: z.string().trim().min(3, 'Indiquez un motif de 3 à 255 caractères.').max(255, 'Le motif ne peut pas dépasser 255 caractères.'),
  replace: z.boolean(),
});
export type LeaseNoticeValues = z.input<typeof leaseNoticeSchema>;

export const endParticipantSchema = z.object({ validTo: requiredDate('Dernier jour de présence') });
export type EndParticipantValues = z.input<typeof endParticipantSchema>;

export const noticeFilterSchema = z.object({ status: z.enum(['submitted', 'acknowledged', 'withdrawn', 'closed']).nullable() });
