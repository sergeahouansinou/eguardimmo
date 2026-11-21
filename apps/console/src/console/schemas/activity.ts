import { z } from 'zod';
import { isoDateTimeSchema } from './common';

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ACTION_PATTERN = /^[a-z0-9_.]+$/;

const nullableText = z.string().nullable();

export const activityEntrySchema = z.object({
  id: z.string().min(1),
  occurredAt: isoDateTimeSchema,
  action: z.string().min(1),
  actor: z.object({ id: z.string().min(1), name: nullableText, email: nullableText }).nullable(),
  organizationId: nullableText,
  subject: z.object({ type: z.string().min(1), id: nullableText }).nullable(),
  changes: z.array(z.object({ field: z.string().min(1), before: z.string(), after: z.string() })),
  metadata: z.array(z.object({ key: z.string().min(1), value: z.string() })),
  requestId: nullableText,
  route: nullableText,
  ip: nullableText,
  userAgent: nullableText,
  redacted: z.boolean(),
});
export type ActivityEntry = z.infer<typeof activityEntrySchema>;

export const activityListSchema = z.object({
  rows: z.array(activityEntrySchema),
  perPage: z.number().int().positive(),
  nextCursor: nullableText,
  prevCursor: nullableText,
});
export type ActivityList = z.infer<typeof activityListSchema>;

export interface ActivityQuery {
  action?: string;
  actor?: string;
  organization?: string;
  requestId?: string;
  subjectType?: string;
  subjectId?: string;
  from?: string;
  to?: string;
  cursor?: string;
  perPage?: number;
}

export type ActivityFilterField = 'action' | 'actor' | 'organization' | 'requestId' | 'subjectType' | 'subjectId' | 'from' | 'to';
export type ActivityFilters = Record<ActivityFilterField, string>;

export const EMPTY_ACTIVITY_FILTERS: ActivityFilters = {
  action: '',
  actor: '',
  organization: '',
  requestId: '',
  subjectType: '',
  subjectId: '',
  from: '',
  to: '',
};

export function validateActivityFilters(filters: ActivityFilters): Partial<Record<ActivityFilterField, string>> {
  const errors: Partial<Record<ActivityFilterField, string>> = {};
  const action = filters.action.trim();
  if (action !== '' && (action.length > 100 || !ACTION_PATTERN.test(action))) errors.action = 'Lettres minuscules, chiffres, points et soulignés.';
  for (const field of ['actor', 'organization', 'requestId', 'subjectId'] as const) {
    const value = filters[field].trim();
    if (value !== '' && !UUID_PATTERN.test(value)) errors[field] = 'Identifiant invalide (UUID attendu).';
  }
  if (filters.subjectId.trim() !== '' && filters.subjectType.trim() === '') errors.subjectType = 'Requis avec l’identifiant d’entité.';
  if (filters.from !== '' && filters.to !== '' && filters.from > filters.to) errors.to = 'La fin précède le début.';
  return errors;
}
