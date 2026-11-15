import {
  ConsoleError,
  clarificationInputSchema,
  matchesQuery,
  paginate,
  rgpdDetailSchema,
  rgpdListSchema,
  rgpdQuerySchema,
} from '../../schemas';
import type { RgpdRow } from '../../schemas';
import type { RgpdApi } from '../../source';
import { daysBetween } from '@/lib/format';
import { requireFound } from '../context';
import type { DemoContext } from '../context';
import { deriveState, dueDate, scopeFor } from '../rgpd';
import type { RgpdRecord } from '../rgpd';

const STATE_ORDER = { a_traiter: 0, en_cours: 1, cloturee: 2 } as const;

function closedOn(record: RgpdRecord): string | null {
  const last = record.steps.at(-1);
  return deriveState(record.steps) === 'cloturee' ? (last?.doneOn ?? null) : null;
}

function toRow(record: RgpdRecord, ctx: DemoContext): RgpdRow {
  const state = deriveState(record.steps);
  const org = ctx.state.orgs.find((candidate) => candidate.id === record.organisationId);
  const due = dueDate(record.receivedOn);
  return {
    id: record.id,
    requester: record.requester,
    type: record.type,
    organisationId: record.organisationId,
    organisationName: org?.name ?? record.organisationId,
    receivedOn: record.receivedOn,
    dueOn: due,
    closedOn: closedOn(record),
    state,
    daysLeft: state === 'cloturee' ? null : daysBetween(ctx.clock().toISOString(), due),
  };
}

export function sortedRgpdRows(ctx: DemoContext): RgpdRow[] {
  return ctx.state.rgpd
    .map((record) => toRow(record, ctx))
    .sort((left, right) => {
      if (left.state !== right.state) return STATE_ORDER[left.state] - STATE_ORDER[right.state];
      return left.state === 'cloturee' ? right.receivedOn.localeCompare(left.receivedOn) : left.dueOn.localeCompare(right.dueOn);
    });
}

function findRecord(ctx: DemoContext, id: string): RgpdRecord {
  return requireFound(ctx.state.rgpd.find((record) => record.id === id), 'Demande');
}

export function rgpdApi(ctx: DemoContext): RgpdApi {
  const parisToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(ctx.clock());

  return {
    list: (rawQuery) => {
      const query = rgpdQuerySchema.parse(rawQuery);
      const base = sortedRgpdRows(ctx).filter(
        (row) =>
          matchesQuery(query.q, row.requester) &&
          (query.type === '' || row.type === query.type) &&
          (query.organisationId === '' || row.organisationId === query.organisationId),
      );
      const rows = base.filter((row) => query.state === '' || row.state === query.state);
      const all = sortedRgpdRows(ctx);
      const toProcess = all.filter((row) => row.state === 'a_traiter');
      const closed = all.filter((row) => row.state === 'cloturee');
      const durations = closed.map((row) => daysBetween(row.receivedOn, row.closedOn ?? row.receivedOn));
      const organisations = [...new Map(ctx.state.rgpd.map((record) => [record.organisationId, ctx.state.orgs.find((org) => org.id === record.organisationId)?.name ?? record.organisationId])).entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((left, right) => left.name.localeCompare(right.name, 'fr'));
      return Promise.resolve(
        rgpdListSchema.parse({
          ...paginate(rows, query.page, query.pageSize),
          counts: {
            all: base.length,
            a_traiter: base.filter((row) => row.state === 'a_traiter').length,
            en_cours: base.filter((row) => row.state === 'en_cours').length,
            cloturee: base.filter((row) => row.state === 'cloturee').length,
          },
          stats: {
            toProcess: toProcess.length,
            nearestDue: toProcess[0]?.dueOn ?? null,
            inProgress: all.filter((row) => row.state === 'en_cours').length,
            closed: closed.length,
            averageDays: durations.length === 0 ? 0 : Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length),
          },
          organisations,
        }),
      );
    },

    get: (id) => {
      const record = findRecord(ctx, id);
      const nextStep = record.steps.find((step) => step.doneOn === null) ?? null;
      return Promise.resolve(
        rgpdDetailSchema.parse({
          request: toRow(record, ctx),
          profile: record.profile,
          channel: record.channel,
          email: record.email,
          steps: record.steps,
          scope: scopeFor(record.type),
          timeline: record.timeline,
          messages: record.messages,
          nextStep,
        }),
      );
    },

    requestClarification: (id, rawInput) => {
      const input = clarificationInputSchema.parse(rawInput);
      const record = findRecord(ctx, id);
      if (deriveState(record.steps) === 'cloturee') throw new ConsoleError('conflict', 'Cette demande est clôturée.');
      const at = ctx.clock().toISOString();
      record.messages.push({ id: `m${String(record.messages.length + 1)}`, at, text: input.message });
      record.timeline.push({ id: `t${String(record.timeline.length + 1)}`, date: parisToday(), title: 'Précisions demandées', detail: `Message envoyé à ${record.requester}` });
      ctx.audit.record({
        type: 'rgpd',
        title: 'Précisions demandées',
        context: `Registre RGPD, ${record.requester}`,
        action: 'Demande de précisions',
        resource: `Demande ${record.id}`,
        module: 'Conformité',
        request: `POST /api/console/rgpd/${id}/precisions`,
        after: { Message: input.message },
      });
      return Promise.resolve();
    },

    advance: (id, stepKey) => {
      const record = findRecord(ctx, id);
      const step = record.steps.find((candidate) => candidate.key === stepKey);
      if (!step) throw new ConsoleError('not_found', 'Étape introuvable.');
      const next = record.steps.find((candidate) => candidate.doneOn === null);
      if (next?.key !== stepKey) throw new ConsoleError('conflict', 'Cette étape n’est pas la prochaine du workflow.');
      step.doneOn = parisToday();
      const state = deriveState(record.steps);
      record.timeline.push({
        id: `t${String(record.timeline.length + 1)}`,
        date: step.doneOn,
        title: step.label.replace(' à valider', ' validé'),
        detail: `${step.actionLabel} · Lucas Bernard`,
      });
      ctx.audit.record({
        type: 'rgpd',
        title: `${step.actionLabel}, ${record.requester}`,
        context: `Registre RGPD, ${record.requester}${state === 'cloturee' ? ', demande clôturée' : ''}`,
        action: step.actionLabel,
        resource: `Demande ${record.id}`,
        module: 'Conformité',
        request: `POST /api/console/rgpd/${id}/etapes/${stepKey}`,
        justified: step.strong,
        organisationId: record.organisationId,
        organisationName: ctx.state.orgs.find((org) => org.id === record.organisationId)?.name ?? null,
        after: { Étape: step.label, État: state === 'cloturee' ? 'Clôturée' : 'En cours' },
      });
      return Promise.resolve();
    },
  };
}
