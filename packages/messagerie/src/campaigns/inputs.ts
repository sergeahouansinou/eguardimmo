import { z } from 'zod';
import { unknownMergeFields } from './mergeFields';
import { BODY_MAX, MAX_CAMPAIGN_ATTACHMENT_BYTES, MIN_SCHEDULE_MINUTES, SUBJECT_MAX } from './model';
import type { CampaignAudienceKind } from './model';

const audience = z.enum(['tenants', 'mandants']);

export const campaignDraftSchema = z.object({
  subject: z.string().trim().min(1, 'Saisissez l’objet de la campagne').max(SUBJECT_MAX, `${String(SUBJECT_MAX)} caractères au maximum`),
  body: z.string().max(BODY_MAX, '10 000 caractères au maximum'),
  audience,
  buildingIds: z.array(z.string().min(1)),
  copyToHistory: z.boolean(),
});

export const campaignSendSchema = campaignDraftSchema.extend({
  body: z.string().trim().min(1, 'Saisissez le message').max(BODY_MAX, '10 000 caractères au maximum'),
});

export const campaignTestSchema = z.object({
  subject: campaignSendSchema.shape.subject,
  body: campaignSendSchema.shape.body,
  audience,
});

export function mergeFieldIssue(text: string, kind: CampaignAudienceKind): string | null {
  const unknown = unknownMergeFields(text, kind);
  if (unknown.length === 0) return null;
  return `Champ de fusion inconnu : ${unknown.join(', ')}. Insérez les champs proposés sous le message.`;
}

export function scheduleIssue(iso: string, now: Date): string | null {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return 'Choisissez la date et l’heure d’envoi';
  if (at < now.getTime() + MIN_SCHEDULE_MINUTES * 60_000) return `L’envoi doit être programmé dans ${String(MIN_SCHEDULE_MINUTES)} minutes au moins`;
  return null;
}

export function attachmentIssue(file: Pick<File, 'name' | 'size' | 'type'>, count: number, max: number): string | null {
  if (count >= max) return `${String(max)} pièces jointes au maximum.`;
  if (file.type !== 'application/pdf') return `« ${file.name} » : seuls les fichiers PDF sont acceptés.`;
  if (file.size === 0) return `« ${file.name} » est vide.`;
  if (file.size > MAX_CAMPAIGN_ATTACHMENT_BYTES) return `« ${file.name} » dépasse 5 Mo.`;
  return null;
}
