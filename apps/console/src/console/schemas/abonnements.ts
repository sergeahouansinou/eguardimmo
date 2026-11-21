import { z } from 'zod';
import { count, idSchema, isoDateSchema, minorSchema } from './common';

const optionalLimit = (max: number) => z.number().int().min(1).max(max).nullable();

export const planLimitsSchema = z.object({
  users: optionalLimit(10_000),
  lots: optionalLimit(100_000),
  tenants: optionalLimit(1_000_000),
  leases: optionalLimit(1_000_000),
  inspections: optionalLimit(1_000_000),
  storageMb: z.number().int().min(1).max(100_000_000),
  signaturesMonth: optionalLimit(1_000_000),
});
export type PlanLimits = z.infer<typeof planLimitsSchema>;

export const planAudienceSchema = z.enum(['organisation', 'proprietaire']);
export type PlanAudience = z.infer<typeof planAudienceSchema>;

export const PLAN_AUDIENCE_LABELS: Record<PlanAudience, string> = {
  organisation: 'Bailleurs et agences',
  proprietaire: 'Propriétaires',
};

export function planServes(plan: { audience: PlanAudience }, type: string): boolean {
  return plan.audience === (type === 'proprietaire' ? 'proprietaire' : 'organisation');
}

export const planSchema = z.object({
  id: idSchema,
  code: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/),
  name: z.string().min(1),
  audience: planAudienceSchema,
  tagline: z.string(),
  description: z.string(),
  monthlyMinor: minorSchema,
  yearlyMinor: minorSchema,
  trialDays: z.number().int().min(0).max(90),
  limits: planLimitsSchema,
  moduleIds: z.array(idSchema),
  publicSignup: z.boolean(),
});
export type Plan = z.infer<typeof planSchema>;

export const planInputSchema = z.object({
  name: z.string().trim().min(2, 'Le nom doit comporter au moins 2 caractères.').max(60),
  code: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]{1,30}$/, 'Code en minuscules, chiffres et tirets (2 à 31 caractères).'),
  audience: planAudienceSchema,
  description: z.string().trim().max(200),
  monthlyMinor: z.number().int().min(0).max(100_000_00),
  yearlyMinor: z.number().int().min(0).max(1_000_000_00),
  trialDays: z.number().int().min(0).max(90),
  limits: planLimitsSchema,
  moduleIds: z.array(idSchema).min(1),
  publicSignup: z.boolean(),
});
export type PlanInput = z.infer<typeof planInputSchema>;

export const planRowSchema = planSchema.extend({
  organisations: count,
  trials: count,
  mrrMinor: minorSchema,
});
export type PlanRow = z.infer<typeof planRowSchema>;

export const subscriptionsOverviewSchema = z.object({
  mrrMinor: minorSchema,
  arrMinor: minorSchema,
  payingCount: count,
  trialCount: count,
  nextTrialEnd: isoDateSchema.nullable(),
  failedCount: count,
  plans: z.array(planRowSchema),
  totals: z.object({ organisations: count, trials: count, mrrMinor: minorSchema }),
  trials: z.array(z.object({ organisationId: idSchema, name: z.string(), planName: z.string(), endsOn: isoDateSchema })),
  failures: z.array(
    z.object({
      organisationId: idSchema,
      name: z.string(),
      detail: z.string(),
      status: z.string(),
      tone: z.enum(['warning', 'danger']),
    }),
  ),
});
export type SubscriptionsOverview = z.infer<typeof subscriptionsOverviewSchema>;

export const planDetailSchema = z.object({
  plan: planSchema,
  organisations: count,
  trials: count,
  payingOrganisations: count,
  mrrMinor: minorSchema,
});
export type PlanDetail = z.infer<typeof planDetailSchema>;
