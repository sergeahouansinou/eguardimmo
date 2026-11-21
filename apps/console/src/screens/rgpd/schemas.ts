import { z } from 'zod';
import { RECORDABLE_CHANNELS, REQUEST_KINDS } from '@/platform/privacy/privacy';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const todayIso = (now: Date = new Date()): string => {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${String(now.getFullYear())}-${month}-${day}`;
};

export const recordRequestSchema = z.object({
  kind: z.enum(REQUEST_KINDS, { message: 'Choisissez le type de demande.' }),
  channel: z.enum(RECORDABLE_CHANNELS, { message: 'Choisissez le canal de réception.' }),
  requesterEmail: z.string().trim().min(1, 'Saisissez l’adresse e-mail du demandeur.').max(255, 'Adresse trop longue.').pipe(z.email('Adresse e-mail invalide.')),
  receivedOn: z
    .string()
    .trim()
    .refine((value) => value === '' || (DAY.test(value) && !Number.isNaN(Date.parse(value))), 'Date invalide.')
    .refine((value) => value === '' || value <= todayIso(), 'La date de réception ne peut pas être dans le futur.'),
});

export interface RecordRequestForm {
  kind: string;
  channel: string;
  requesterEmail: string;
  receivedOn: string;
}
export type RecordRequestErrors = Partial<Record<keyof RecordRequestForm, string>>;

export function validateRecordRequest(input: RecordRequestForm): { ok: true; data: z.output<typeof recordRequestSchema> } | { ok: false; errors: RecordRequestErrors } {
  const parsed = recordRequestSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const errors: RecordRequestErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if ((field === 'kind' || field === 'channel' || field === 'requesterEmail' || field === 'receivedOn') && errors[field] === undefined) errors[field] = issue.message;
  }
  return { ok: false, errors };
}
