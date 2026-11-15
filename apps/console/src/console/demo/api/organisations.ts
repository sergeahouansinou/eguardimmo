import {
  ConsoleError,
  accessRequestInputSchema,
  createOrganisationInputSchema,
  matchesQuery,
  organisationDetailSchema,
  organisationListSchema,
  organisationModulesSchema,
  paginate,
  suspendInputSchema,
  updateOrganisationInputSchema,
} from '../../schemas';
import type { OrganisationDetail, OrganisationRow } from '../../schemas';
import { MODULE_GROUP_LABELS, listQuerySchema, organisationFiltersSchema } from '../../schemas';
import type { OrganisationsApi } from '../../source';
import { formatDecimal, formatInteger } from '@/lib/format';
import { MODULE_SEEDS } from '../catalog';
import { addDays, parisDay } from '../clock';
import { requireFound } from '../context';
import type { DemoContext } from '../context';
import { slug } from '../organisations';
import type { OrgRecord } from '../organisations';

const dateFr = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

export function toOrganisationRow(org: OrgRecord, ctx: DemoContext): OrganisationRow {
  const plan = requireFound(ctx.state.plans.find((candidate) => candidate.id === org.planId), 'Plan');
  return {
    id: org.id,
    name: org.name,
    type: org.type,
    planId: org.planId,
    planName: plan.name,
    state: org.state,
    trialEndsOn: org.trialEndsOn,
    createdOn: org.createdOn,
    userCount: org.users.length,
  };
}

export function effectiveModules(org: OrgRecord, ctx: DemoContext): Set<string> {
  const plan = requireFound(ctx.state.plans.find((candidate) => candidate.id === org.planId), 'Plan');
  const enabled = new Set(plan.moduleIds);
  for (const [id, override] of Object.entries(org.moduleOverrides)) {
    if (override.enabled) enabled.add(id);
    else enabled.delete(id);
  }
  return enabled;
}

function cascade(enabled: Set<string>): Set<string> {
  let changed = true;
  while (changed) {
    changed = false;
    for (const seed of MODULE_SEEDS) {
      if (enabled.has(seed.id) && (seed.requires ?? []).some((required) => !enabled.has(required))) {
        enabled.delete(seed.id);
        changed = true;
      }
    }
  }
  return enabled;
}

function findOrg(ctx: DemoContext, id: string): OrgRecord {
  return requireFound(ctx.state.orgs.find((org) => org.id === id), 'Organisation');
}

export function organisationsApi(ctx: DemoContext): OrganisationsApi {
  const today = () => parisDay(ctx.clock());
  const flagsFor = (id: string) => ({ organisationId: id, organisationName: findOrg(ctx, id).name });

  return {
    list: (rawQuery) => {
      const query = listQuerySchema.parse(rawQuery);
      const filters = organisationFiltersSchema.parse(rawQuery);
      const rows = ctx.state.orgs
        .map((org) => toOrganisationRow(org, ctx))
        .filter((row) => matchesQuery(query.q, row.name, row.id) && (filters.planId === '' || row.planId === filters.planId) && (filters.state === '' || row.state === filters.state));
      const filtered = rows.filter((row) => filters.type === '' || row.type === filters.type);
      const all = ctx.state.orgs.map((org) => toOrganisationRow(org, ctx));
      const trialEnds = all.flatMap((row) => (row.state === 'essai' && row.trialEndsOn ? [row.trialEndsOn] : [])).sort();
      return Promise.resolve(
        organisationListSchema.parse({
          ...paginate(filtered, query.page, query.pageSize),
          counts: {
            all: rows.length,
            bailleur: rows.filter((row) => row.type === 'bailleur').length,
            agence: rows.filter((row) => row.type === 'agence').length,
            proprietaire: rows.filter((row) => row.type === 'proprietaire').length,
          },
          stats: {
            total: all.length,
            bailleurs: all.filter((row) => row.type === 'bailleur').length,
            agences: all.filter((row) => row.type === 'agence').length,
            proprietaires: all.filter((row) => row.type === 'proprietaire').length,
            actives: all.filter((row) => row.state !== 'suspendue').length - all.filter((row) => row.state === 'essai').length,
            essais: all.filter((row) => row.state === 'essai').length,
            suspendues: all.filter((row) => row.state === 'suspendue').length,
            nextTrialEnd: trialEnds[0] ?? null,
          },
        }),
      );
    },

    get: (id) => {
      const org = findOrg(ctx, id);
      const plan = requireFound(ctx.state.plans.find((candidate) => candidate.id === org.planId), 'Plan');
      const enabled = effectiveModules(org, ctx);
      const disabled = MODULE_SEEDS.filter((seed) => !enabled.has(seed.id)).map((seed) => ({
        id: seed.id,
        name: seed.name,
        reason: org.moduleOverrides[seed.id]?.reason ?? `Hors du plan ${plan.name}`,
      }));
      const orgEvents = ctx.audit.events
        .filter((event) => event.organisationId === org.id)
        .sort((left, right) => Date.parse(right.at) - Date.parse(left.at));
      const storageText = `${formatDecimal(org.usage.storageMb / 1000)} sur ${String(plan.limits.storageGb)} Go`;
      const detail: OrganisationDetail = {
        organisation: toOrganisationRow(org, ctx),
        holder: org.holder,
        contactEmail: org.contactEmail,
        headquarters: org.headquarters,
        activity: org.activity,
        creation: org.creation,
        planMonthlyMinor: plan.monthlyMinor,
        includedUsers: plan.limits.users,
        modules: { enabled: enabled.size, total: MODULE_SEEDS.length, disabled },
        usage: [
          { id: 'users', label: 'Utilisateurs', value: org.users.length, max: plan.limits.users, text: `${String(org.users.length)} sur ${String(plan.limits.users)}` },
          { id: 'lots', label: 'Lots', value: org.usage.lots, max: plan.limits.lots, text: `${String(org.usage.lots)} sur ${String(plan.limits.lots)}` },
          { id: 'storage', label: 'Stockage', value: org.usage.storageMb, max: plan.limits.storageGb * 1000, text: storageText },
          { id: 'emails', label: 'E-mails du mois', value: org.usage.emailsMonth, max: plan.limits.emailsMonth, text: `${formatInteger(org.usage.emailsMonth)} sur ${formatInteger(plan.limits.emailsMonth)}` },
        ],
        users: org.users,
        lastActivity: org.lastActivity,
        recentActions: orgEvents.slice(0, 4).map((event) => ({
          id: event.id,
          at: event.at,
          title: event.title,
          context: event.actor.name,
          operator: event.justified,
        })),
        auditTotal: orgEvents.length,
        accesses: [...org.accesses].sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt)),
      };
      return Promise.resolve(organisationDetailSchema.parse(detail));
    },

    modules: (id) => {
      const org = findOrg(ctx, id);
      const enabled = effectiveModules(org, ctx);
      const groups = (['socle', 'gestion', 'suivi', 'pilotage'] as const).map((group) => ({
        group,
        label: MODULE_GROUP_LABELS[group],
        modules: MODULE_SEEDS.filter((seed) => seed.group === group).map((seed) => ({
          id: seed.id,
          name: seed.name,
          description: seed.description,
          mandatory: seed.mandatory ?? false,
          enabled: seed.mandatory === true || enabled.has(seed.id),
          degraded: seed.id === 'messagerie' && ctx.state.incidents.some((incident) => incident.state === 'en_cours' && incident.moduleId === 'messagerie'),
          requires: seed.requires ?? [],
        })),
      }));
      return Promise.resolve(
        organisationModulesSchema.parse({
          organisation: { id: org.id, name: org.name },
          total: MODULE_SEEDS.length,
          enabled: MODULE_SEEDS.filter((seed) => seed.mandatory === true || enabled.has(seed.id)).length,
          groups,
        }),
      );
    },

    create: (rawInput) => {
      const input = createOrganisationInputSchema.parse(rawInput);
      const plan = requireFound(ctx.state.plans.find((candidate) => candidate.id === input.planId), 'Plan');
      if (plan.audience !== input.type) throw new ConsoleError('invalid', `Le plan ${plan.name} ne s’adresse pas à ce type d’organisation.`);
      const id = slug(input.name);
      if (ctx.state.orgs.some((org) => org.id === id)) throw new ConsoleError('conflict', 'Une organisation porte déjà ce nom.');
      const day = today();
      const holderName = `${input.holderFirstName} ${input.holderLastName}`;
      const record: OrgRecord = {
        id,
        name: input.name,
        type: input.type,
        planId: plan.id,
        state: input.trial ? 'essai' : 'active',
        trialEndsOn: input.trial ? addDays(day, plan.trialDays > 0 ? plan.trialDays : 30) : null,
        createdOn: day,
        holder: { name: holderName, email: input.holderEmail },
        contactEmail: input.holderEmail,
        headquarters: input.headquarters,
        activity: 'Organisation créée par l’opérateur, invitation en attente',
        creation: `${dateFr(day)}, par l’opérateur`,
        users: [{ id: `${id}-u1`, name: holderName, role: 'Titulaire', lastLoginAt: ctx.clock().toISOString() }],
        usage: { lots: 0, storageMb: 0, emailsMonth: 0 },
        lastActivity: { at: ctx.clock().toISOString(), by: holderName },
        moduleOverrides: {},
        accesses: [],
      };
      ctx.state.orgs.unshift(record);
      ctx.audit.record({
        type: 'organisation',
        title: 'Organisation créée',
        context: `${record.name}, plan ${plan.name}, invitation envoyée à ${input.holderEmail}`,
        action: 'Création',
        ...flagsFor(id),
        module: 'Organisations',
        request: 'POST /api/console/organisations',
        after: { Nom: record.name, Plan: plan.name, Essai: input.trial ? 'Oui' : 'Non' },
      });
      return Promise.resolve({ id });
    },

    update: (id, rawInput) => {
      const input = updateOrganisationInputSchema.parse(rawInput);
      const org = findOrg(ctx, id);
      const before = { Nom: org.name, Contact: org.contactEmail, Siège: org.headquarters };
      org.name = input.name;
      org.contactEmail = input.contactEmail;
      org.headquarters = input.headquarters;
      ctx.audit.record({
        type: 'organisation',
        title: 'Informations modifiées',
        context: org.name,
        action: 'Modification',
        ...flagsFor(id),
        module: 'Organisations',
        request: `PATCH /api/console/organisations/${id}`,
        before,
        after: { Nom: org.name, Contact: org.contactEmail, Siège: org.headquarters },
      });
      return Promise.resolve();
    },

    suspend: (id, rawInput) => {
      const input = suspendInputSchema.parse(rawInput);
      const org = findOrg(ctx, id);
      if (org.state === 'suspendue') throw new ConsoleError('conflict', 'Cette organisation est déjà suspendue.');
      const previous = org.state;
      org.state = 'suspendue';
      ctx.audit.record({
        type: 'organisation',
        title: 'Organisation suspendue',
        context: `${org.name}, motif : ${input.reason}`,
        action: 'Suspension',
        ...flagsFor(id),
        module: 'Organisations',
        request: `POST /api/console/organisations/${id}/suspension`,
        before: { État: previous === 'essai' ? 'Essai' : 'Active' },
        after: { État: 'Suspendue' },
      });
      return Promise.resolve();
    },

    reactivate: (id) => {
      const org = findOrg(ctx, id);
      if (org.state !== 'suspendue') throw new ConsoleError('conflict', 'Cette organisation n’est pas suspendue.');
      org.state = org.trialEndsOn !== null && org.trialEndsOn > today() ? 'essai' : 'active';
      ctx.audit.record({
        type: 'organisation',
        title: 'Organisation réactivée',
        context: org.name,
        action: 'Réactivation',
        ...flagsFor(id),
        module: 'Organisations',
        request: `DELETE /api/console/organisations/${id}/suspension`,
        before: { État: 'Suspendue' },
        after: { État: org.state === 'essai' ? 'Essai' : 'Active' },
      });
      return Promise.resolve();
    },

    changePlan: (id, planId) => {
      const org = findOrg(ctx, id);
      const plan = requireFound(ctx.state.plans.find((candidate) => candidate.id === planId), 'Plan');
      if (plan.audience !== org.type) throw new ConsoleError('invalid', `Le plan ${plan.name} ne s’adresse pas à ce type d’organisation.`);
      if (org.planId === plan.id) throw new ConsoleError('conflict', 'L’organisation est déjà sur ce plan.');
      const previous = requireFound(ctx.state.plans.find((candidate) => candidate.id === org.planId), 'Plan');
      org.planId = plan.id;
      ctx.audit.record({
        type: 'abonnement',
        title: 'Plan modifié',
        context: `${org.name}, ${previous.name} vers ${plan.name}`,
        action: 'Changement de plan',
        ...flagsFor(id),
        module: 'Abonnements',
        request: `PUT /api/console/organisations/${id}/plan`,
        before: { Plan: previous.name },
        after: { Plan: plan.name },
      });
      return Promise.resolve();
    },

    setModules: (id, enabledIds) => {
      const org = findOrg(ctx, id);
      const plan = requireFound(ctx.state.plans.find((candidate) => candidate.id === org.planId), 'Plan');
      const known = new Set(MODULE_SEEDS.map((seed) => seed.id));
      if (enabledIds.some((moduleId) => !known.has(moduleId))) throw new ConsoleError('invalid', 'Module inconnu.');
      const previous = effectiveModules(org, ctx);
      const desired = cascade(new Set([...enabledIds, ...MODULE_SEEDS.filter((seed) => seed.mandatory === true).map((seed) => seed.id)]));
      const inPlan = new Set(plan.moduleIds);
      const overrides: OrgRecord['moduleOverrides'] = {};
      for (const seed of MODULE_SEEDS) {
        const wanted = desired.has(seed.id);
        if (wanted === inPlan.has(seed.id)) continue;
        overrides[seed.id] = {
          enabled: wanted,
          reason: wanted ? `Activé hors plan par l'opérateur, le ${dateFr(today())}` : `Désactivé par l'opérateur, le ${dateFr(today())}`,
        };
      }
      const nameOf = (moduleId: string) => MODULE_SEEDS.find((seed) => seed.id === moduleId)?.name ?? moduleId;
      const added = [...desired].filter((moduleId) => !previous.has(moduleId)).map(nameOf);
      const removed = [...previous].filter((moduleId) => !desired.has(moduleId)).map(nameOf);
      org.moduleOverrides = overrides;
      ctx.audit.record({
        type: 'module',
        title: 'Modules modifiés',
        context: `${org.name}, ${String(added.length)} activé(s), ${String(removed.length)} désactivé(s)`,
        action: 'Modification des modules',
        ...flagsFor(id),
        module: 'Organisations',
        request: `PUT /api/console/organisations/${id}/modules`,
        before: { Activés: String(previous.size), Désactivés: removed.join(', ') || 'Aucun' },
        after: { Activés: String(desired.size), Ajoutés: added.join(', ') || 'Aucun' },
      });
      return Promise.resolve();
    },

    requestAccess: (id, rawInput) => {
      const input = accessRequestInputSchema.parse(rawInput);
      const org = findOrg(ctx, id);
      const now = ctx.clock();
      const minutes = ctx.state.security.justifiedAccessMinutes;
      const ends = new Date(now.getTime() + minutes * 60_000);
      org.accesses.unshift({
        id: `acc-${String(Date.now())}`,
        ticket: input.ticket === '' ? 'Sans ticket' : input.ticket,
        operator: 'Lucas Bernard',
        reason: input.reason,
        startedAt: now.toISOString(),
        endsAt: ends.toISOString(),
        active: true,
      });
      ctx.audit.record({
        type: 'acces_justifie',
        title: 'Accès aux données ouvert',
        context: `${org.name}, ${input.ticket === '' ? 'sans ticket' : `ticket ${input.ticket}`}, ${String(minutes)} min`,
        action: 'Ouverture',
        ...flagsFor(id),
        module: 'Console',
        request: `POST /api/console/organisations/${id}/acces`,
        after: { Motif: input.reason, Durée: `${String(minutes)} minutes` },
        justified: true,
      });
      return Promise.resolve();
    },
  };
}
