import {
  ConsoleError,
  planDetailSchema,
  planInputSchema,
  subscriptionsOverviewSchema,
} from '../../schemas';
import type { PlanRow } from '../../schemas';
import type { AbonnementsApi } from '../../source';
import { MODULE_SEEDS } from '../catalog';
import { requireFound } from '../context';
import type { DemoContext } from '../context';
import { slug } from '../organisations';

export function planRows(ctx: DemoContext): PlanRow[] {
  return ctx.state.plans.map((plan) => {
    const orgs = ctx.state.orgs.filter((org) => org.planId === plan.id);
    const trials = orgs.filter((org) => org.state === 'essai').length;
    return { ...plan, organisations: orgs.length, trials, mrrMinor: (orgs.length - trials) * plan.monthlyMinor };
  });
}

const FAILURES = [
  { organisationId: 'residences-du-parc', name: 'Résidences du Parc', detail: 'Prélèvement refusé le 01/11/2026 · 79 €', status: 'Relance 2 sur 3', tone: 'danger' as const },
  { organisationId: 'agence-port-sud', name: 'Agence Port-Sud', detail: 'Prélèvement refusé le 01/11/2026 · 199 €', status: 'Suspendue', tone: 'danger' as const },
];

export function abonnementsApi(ctx: DemoContext): AbonnementsApi {
  const validate = (input: ReturnType<typeof planInputSchema.parse>) => {
    const mandatory = MODULE_SEEDS.filter((seed) => seed.mandatory === true).map((seed) => seed.id);
    const known = new Set(MODULE_SEEDS.map((seed) => seed.id));
    if (input.moduleIds.some((id) => !known.has(id))) throw new ConsoleError('invalid', 'Module inconnu.');
    if (mandatory.some((id) => !input.moduleIds.includes(id))) throw new ConsoleError('invalid', 'Les modules du socle sont obligatoires.');
    for (const seed of MODULE_SEEDS) {
      if (input.moduleIds.includes(seed.id) && (seed.requires ?? []).some((required) => !input.moduleIds.includes(required))) {
        throw new ConsoleError('invalid', `${seed.name} exige ${(seed.requires ?? []).map((required) => MODULE_SEEDS.find((candidate) => candidate.id === required)?.name ?? required).join(', ')}.`);
      }
    }
  };

  return {
    overview: () => {
      const plans = planRows(ctx);
      const trials = ctx.state.orgs
        .filter((org) => org.state === 'essai' && org.trialEndsOn !== null)
        .sort((left, right) => (left.trialEndsOn ?? '').localeCompare(right.trialEndsOn ?? ''));
      const mrrMinor = plans.reduce((sum, plan) => sum + plan.mrrMinor, 0);
      return Promise.resolve(
        subscriptionsOverviewSchema.parse({
          mrrMinor,
          arrMinor: mrrMinor * 12,
          payingCount: plans.filter((plan) => plan.monthlyMinor > 0).reduce((sum, plan) => sum + plan.organisations - plan.trials, 0),
          trialCount: trials.length,
          nextTrialEnd: trials[0]?.trialEndsOn ?? null,
          failedCount: FAILURES.length,
          plans,
          totals: {
            organisations: plans.reduce((sum, plan) => sum + plan.organisations, 0),
            trials: plans.reduce((sum, plan) => sum + plan.trials, 0),
            mrrMinor,
          },
          trials: trials.map((org) => ({
            organisationId: org.id,
            name: org.name,
            planName: ctx.state.plans.find((plan) => plan.id === org.planId)?.name ?? '',
            endsOn: org.trialEndsOn ?? '',
          })),
          failures: FAILURES,
        }),
      );
    },

    plan: (id) => {
      const row = requireFound(planRows(ctx).find((plan) => plan.id === id), 'Plan');
      const { organisations, trials, mrrMinor, ...plan } = row;
      return Promise.resolve(planDetailSchema.parse({ plan, organisations, trials, payingOrganisations: organisations - trials, mrrMinor }));
    },

    createPlan: (rawInput) => {
      const input = planInputSchema.parse(rawInput);
      validate(input);
      const id = slug(input.code);
      if (ctx.state.plans.some((plan) => plan.id === id)) throw new ConsoleError('conflict', 'Ce code de plan est déjà utilisé.');
      ctx.state.plans.push({
        id,
        code: input.code,
        name: input.name,
        audience: input.audience,
        tagline: input.audience === 'agence' ? 'agences sous mandat' : input.audience === 'bailleur' ? 'bailleurs' : 'propriétaires',
        description: input.description,
        monthlyMinor: input.monthlyMinor,
        yearlyMinor: input.yearlyMinor,
        trialDays: input.trialDays,
        limits: input.limits,
        moduleIds: input.moduleIds,
        publicSignup: input.publicSignup,
      });
      ctx.audit.record({
        type: 'abonnement',
        title: 'Plan créé',
        context: `${input.name}, ${String(input.monthlyMinor)} centimes par mois`,
        action: 'Création de plan',
        module: 'Abonnements',
        request: 'POST /api/console/plans',
        after: { Plan: input.name, 'Prix mensuel (centimes)': String(input.monthlyMinor), 'Prix annuel (centimes)': String(input.yearlyMinor) },
      });
      return Promise.resolve({ id });
    },

    updatePlan: (id, rawInput) => {
      const input = planInputSchema.parse(rawInput);
      validate(input);
      const plan = requireFound(ctx.state.plans.find((candidate) => candidate.id === id), 'Plan');
      if (ctx.state.plans.some((candidate) => candidate.id !== id && candidate.code === input.code)) throw new ConsoleError('conflict', 'Ce code de plan est déjà utilisé.');
      const before = {
        'Prix mensuel (centimes)': String(plan.monthlyMinor),
        'Prix annuel (centimes)': String(plan.yearlyMinor),
        Modules: String(plan.moduleIds.length),
        Utilisateurs: String(plan.limits.users),
      };
      Object.assign(plan, {
        code: input.code,
        name: input.name,
        audience: input.audience,
        description: input.description,
        monthlyMinor: input.monthlyMinor,
        yearlyMinor: input.yearlyMinor,
        trialDays: input.trialDays,
        limits: input.limits,
        moduleIds: input.moduleIds,
        publicSignup: input.publicSignup,
      });
      ctx.audit.record({
        type: 'abonnement',
        title: 'Plan modifié',
        context: `${plan.name}, effet à la prochaine échéance`,
        action: 'Modification de plan',
        module: 'Abonnements',
        request: `PUT /api/console/plans/${id}`,
        before,
        after: {
          'Prix mensuel (centimes)': String(plan.monthlyMinor),
          'Prix annuel (centimes)': String(plan.yearlyMinor),
          Modules: String(plan.moduleIds.length),
          Utilisateurs: String(plan.limits.users),
        },
      });
      return Promise.resolve();
    },
  };
}
