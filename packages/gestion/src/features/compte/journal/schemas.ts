import { z } from 'zod';

export const EVENT_TYPES = ['connexion', 'droits', 'paiement', 'document', 'export', 'securite'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  connexion: 'Connexion',
  droits: 'Droits',
  paiement: 'Paiement',
  document: 'Document',
  export: 'Export',
  securite: 'Sécurité',
};

export const journalEventSchema = z.object({
  id: z.string().min(1),
  at: z.iso.datetime({ offset: true }),
  memberId: z.string().min(1),
  member: z.string().min(1),
  initials: z.string().min(1).max(2),
  type: z.enum(EVENT_TYPES),
  action: z.string().min(1),
  detail: z.string(),
  origin: z.string().min(1),
  device: z.string().min(1),
  fingerprint: z.string().min(1),
  before: z.string().optional(),
  after: z.string().optional(),
});
export type JournalEvent = z.infer<typeof journalEventSchema>;
export const journalEventsSchema = z.array(journalEventSchema);
