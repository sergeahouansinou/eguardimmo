import type { ApiError } from '@eguardimmo/api';

export const SUBSCRIPTION_PATH = '/compte/abonnement';
export const PLAN_QUOTA_REACHED = 'plan_quota_reached';
export const FEATURE_NOT_IN_PLAN = 'feature_not_in_plan';

const PLAN_LIMIT_CODES: readonly string[] = [PLAN_QUOTA_REACHED, FEATURE_NOT_IN_PLAN];
const UPGRADE_HINT = 'Passez à une formule supérieure pour continuer.';

interface FeatureLabel {
  one: string;
  many: string;
}

const FEATURE_LABELS: Readonly<Record<string, FeatureLabel>> = {
  properties: { one: 'lot', many: 'lots' },
  leases: { one: 'bail', many: 'baux' },
  inspections: { one: 'état des lieux', many: 'états des lieux' },
  users: { one: 'membre', many: 'membres' },
  tenants: { one: 'locataire', many: 'locataires' },
  signatures_monthly: { one: 'signature ce mois-ci', many: 'signatures ce mois-ci' },
};

export const isPlanLimitCode = (code: string): boolean => PLAN_LIMIT_CODES.includes(code);

export function isPlanLimitError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && typeof error.code === 'string' && isPlanLimitCode(error.code);
}

export const isPlanFeatureError = (error: unknown): boolean => error instanceof Error && 'code' in error && error.code === FEATURE_NOT_IN_PLAN;

const count = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);

function featureLabel(extensions: Readonly<Record<string, unknown>>): FeatureLabel | null {
  const feature = extensions.feature;
  return typeof feature === 'string' ? (FEATURE_LABELS[feature] ?? null) : null;
}

export function planLimitMessage(error: Pick<ApiError, 'code' | 'extensions'>): string | null {
  if (error.code === FEATURE_NOT_IN_PLAN) {
    const label = featureLabel(error.extensions);
    return `Cette fonction${label ? ` (${label.many})` : ''} n’est pas incluse dans votre plan. ${UPGRADE_HINT}`;
  }
  if (error.code !== PLAN_QUOTA_REACHED) return null;
  const current = count(error.extensions.current);
  const limit = count(error.extensions.limit);
  if (current === null || limit === null) return `Limite de votre plan atteinte. ${UPGRADE_HINT}`;
  const label = featureLabel(error.extensions);
  const used = label ? `${String(current)} ${current > 1 ? label.many : label.one}` : String(current);
  return `Limite de votre plan atteinte : ${used} sur ${String(limit)}. ${UPGRADE_HINT}`;
}
