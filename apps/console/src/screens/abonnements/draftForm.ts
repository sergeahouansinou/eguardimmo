import { minorToInput } from '@/lib/format';
import { CURRENCIES } from '@/platform/plans/plans';
import type { PlanEntitlement, PlanVersion, PlanVersionChanges } from '@/platform/plans/plans';
import { parseLimit, parseMajor } from './money';

export interface PriceDraft {
  currency: string;
  monthly: string;
  yearly: string;
}

export interface EntitlementDraft {
  feature: string;
  label: string;
  group: string;
  kind: PlanEntitlement['kind'];
  enabled: boolean;
  limit: string;
}

export interface DraftState {
  publicSignup: boolean;
  prices: PriceDraft[];
  entitlements: EntitlementDraft[];
}

export interface DraftErrors {
  prices: Record<string, string>;
  entitlements: Record<string, string>;
}

export function toDraftState(version: PlanVersion): DraftState {
  return {
    publicSignup: version.publicSignup,
    prices: CURRENCIES.map((currency) => {
      const price = version.prices.find((candidate) => candidate.currency === currency);
      return { currency, monthly: price ? minorToInput(price.monthlyAmount) : '', yearly: price ? minorToInput(price.yearlyAmount) : '' };
    }),
    entitlements: version.entitlements.map((e) => ({ feature: e.feature, label: e.label, group: e.group, kind: e.kind, enabled: e.enabled, limit: e.limit === null ? '' : String(e.limit) })),
  };
}

export type BuildResult = { ok: true; changes: Required<PlanVersionChanges> } | { ok: false; errors: DraftErrors };

export function buildChanges(state: DraftState): BuildResult {
  const errors: DraftErrors = { prices: {}, entitlements: {} };
  const prices: Required<PlanVersionChanges>['prices'] = [];
  for (const draft of state.prices) {
    if (draft.monthly.trim() === '' && draft.yearly.trim() === '') continue;
    const monthly = parseMajor(draft.monthly);
    const yearly = parseMajor(draft.yearly);
    if (monthly === null || yearly === null) {
      errors.prices[draft.currency] = 'Renseignez les deux montants, par exemple 35 ou 35,50.';
      continue;
    }
    prices.push({ currency: draft.currency, monthlyAmount: monthly, yearlyAmount: yearly });
  }
  const entitlements: Required<PlanVersionChanges>['entitlements'] = [];
  for (const draft of state.entitlements) {
    const limit = draft.kind === 'quota' && draft.enabled ? parseLimit(draft.limit) : null;
    if (limit === undefined) {
      errors.entitlements[draft.feature] = 'La limite est un entier positif ; laissez vide pour illimité.';
      continue;
    }
    entitlements.push({ feature: draft.feature, enabled: draft.enabled, limit });
  }
  const failed = Object.keys(errors.prices).length > 0 || Object.keys(errors.entitlements).length > 0;
  return failed ? { ok: false, errors } : { ok: true, changes: { publicSignup: state.publicSignup, prices, entitlements } };
}
