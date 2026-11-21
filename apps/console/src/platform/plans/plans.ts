import type { ApiClient } from '@eguardimmo/api';
import { z } from 'zod';
import { CONSOLE_ROOT, dataOf, nullableDateTime, parse, read, segment, write } from '../transport';

export const PLAN_VERSION_STATUSES = ['draft', 'published', 'archived'] as const;
export type PlanVersionStatus = (typeof PLAN_VERSION_STATUSES)[number];
export const CURRENCIES = ['EUR', 'CAD'] as const;
export type Currency = (typeof CURRENCIES)[number];

const entitlementSchema = z.object({
  feature: z.string().min(1),
  label: z.string(),
  group: z.string(),
  kind: z.enum(['quota', 'function']),
  enabled: z.boolean(),
  limit: z.number().int().nonnegative().nullable(),
});

const versionSchema = z.object({
  id: z.string().min(1),
  plan: z.string().optional(),
  version: z.number().int().positive(),
  status: z.enum(PLAN_VERSION_STATUSES),
  trial_days: z.number().int().nonnegative(),
  public_signup: z.boolean(),
  published_at: nullableDateTime,
  archived_at: nullableDateTime,
  prices: z.array(z.object({ currency: z.string(), monthly_amount: z.number().int().nonnegative(), yearly_amount: z.number().int().nonnegative() })),
  entitlements: z.array(entitlementSchema),
});

const planSchema = z.object({ id: z.string().min(1), code: z.string().min(1), name: z.string(), versions: z.array(versionSchema) });

export interface PlanEntitlement {
  feature: string;
  label: string;
  group: string;
  kind: 'quota' | 'function';
  enabled: boolean;
  limit: number | null;
}

export interface PlanPrice {
  currency: string;
  monthlyAmount: number;
  yearlyAmount: number;
}

export interface PlanVersion {
  id: string;
  version: number;
  status: PlanVersionStatus;
  trialDays: number;
  publicSignup: boolean;
  publishedAt: string | null;
  archivedAt: string | null;
  prices: PlanPrice[];
  entitlements: PlanEntitlement[];
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  versions: PlanVersion[];
}

export interface PlanVersionChanges {
  publicSignup?: boolean;
  prices?: PlanPrice[];
  entitlements?: { feature: string; enabled: boolean; limit: number | null }[];
}

export function toPlanVersion(raw: z.infer<typeof versionSchema>): PlanVersion {
  return {
    id: raw.id,
    version: raw.version,
    status: raw.status,
    trialDays: raw.trial_days,
    publicSignup: raw.public_signup,
    publishedAt: raw.published_at,
    archivedAt: raw.archived_at,
    prices: raw.prices.map((price) => ({ currency: price.currency, monthlyAmount: price.monthly_amount, yearlyAmount: price.yearly_amount })),
    entitlements: raw.entitlements,
  };
}

const toPlan = (raw: z.infer<typeof planSchema>): Plan => ({ id: raw.id, code: raw.code, name: raw.name, versions: raw.versions.map(toPlanVersion) });

export function changesBody(changes: PlanVersionChanges): Record<string, unknown> {
  return {
    ...(changes.publicSignup === undefined ? {} : { public_signup: changes.publicSignup }),
    ...(changes.prices === undefined
      ? {}
      : { prices: changes.prices.map((price) => ({ currency: price.currency, monthly_amount: price.monthlyAmount, yearly_amount: price.yearlyAmount })) }),
    ...(changes.entitlements === undefined
      ? {}
      : { entitlements: changes.entitlements.map((e) => ({ feature: e.feature, enabled: e.enabled, limit_value: e.limit })) }),
  };
}

export interface PlansApi {
  list: () => Promise<Plan[]>;
  get: (code: string) => Promise<Plan>;
  createDraft: (code: string) => Promise<PlanVersion>;
  updateDraft: (versionId: string, changes: PlanVersionChanges) => Promise<PlanVersion>;
}

export function plansApi(client: ApiClient): PlansApi {
  const version = dataOf(versionSchema);
  return {
    list: async () => (await read(client, '/plans', z.object({ data: z.array(planSchema) }))).data.map(toPlan),
    get: async (code) => toPlan((await read(client, `/plans/${segment(code)}`, dataOf(planSchema))).data),
    createDraft: async (code) => toPlanVersion((await write(client, `/plans/${segment(code)}/versions`, version)).data),
    updateDraft: async (versionId, changes) =>
      toPlanVersion(
        parse(version, await client.patch(`${CONSOLE_ROOT}/plan-versions/${segment(versionId)}`, changesBody(changes))).data,
      ),
  };
}
