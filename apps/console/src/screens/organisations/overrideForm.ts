import { OVERRIDE_REASONS } from './labels';

export interface OverrideDraft {
  feature: string;
  enabled: 'true' | 'false';
  limit: string;
  endsAt: string;
  reasonCode: string;
}

export type OverrideErrors = Partial<Record<keyof OverrideDraft, string>>;

export const EMPTY_OVERRIDE: OverrideDraft = { feature: '', enabled: 'true', limit: '', endsAt: '', reasonCode: '' };

const MAX_DAYS = 366;
const DAY_MS = 86_400_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function dayStart(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function validateOverride(
  draft: OverrideDraft,
  quotaFeatures: ReadonlySet<string>,
  now: Date,
): { ok: true; payload: Record<string, string> } | { ok: false; errors: OverrideErrors } {
  const errors: OverrideErrors = {};
  if (draft.feature === '') errors.feature = 'Choisissez la fonction concernée.';
  if (!(OVERRIDE_REASONS as readonly string[]).includes(draft.reasonCode)) errors.reasonCode = 'Choisissez un motif.';
  const end = DATE.test(draft.endsAt) ? Date.parse(`${draft.endsAt}T00:00:00Z`) : Number.NaN;
  if (Number.isNaN(end)) errors.endsAt = 'Indiquez la date de fin.';
  else if (end < dayStart(now)) errors.endsAt = 'La date de fin doit être à venir.';
  else if (end > dayStart(now) + MAX_DAYS * DAY_MS) errors.endsAt = 'La date de fin doit tomber dans les 12 mois.';
  const limit = draft.limit.trim();
  if (limit !== '') {
    if (!quotaFeatures.has(draft.feature)) errors.limit = 'Une limite ne s’applique qu’aux quotas.';
    else if (!/^\d+$/.test(limit)) errors.limit = 'La limite doit être un entier positif ou nul.';
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    payload: {
      feature: draft.feature,
      enabled: draft.enabled,
      ends_at: draft.endsAt,
      reason_code: draft.reasonCode,
      ...(limit === '' ? {} : { limit_value: String(Number(limit)) }),
    },
  };
}
