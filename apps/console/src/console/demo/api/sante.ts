import {
  ConsoleError,
  incidentDetailSchema,
  incidentNoteInputSchema,
  incidentUpdateInputSchema,
  openIncidentInputSchema,
  santeSchema,
} from '../../schemas';
import type { SanteApi } from '../../source';
import { MODULE_SEEDS } from '../catalog';
import { requireFound } from '../context';
import type { DemoContext } from '../context';
import { LATENCY, QUEUES, SERVICES, RUNBOOK_01 } from '../ops';
import type { IncidentRecord } from '../ops';

function findIncident(ctx: DemoContext, id: string): IncidentRecord {
  return requireFound(ctx.state.incidents.find((incident) => incident.id === id), 'Incident');
}

export function incidentSummary(incident: IncidentRecord) {
  return {
    id: incident.id,
    code: incident.code,
    title: incident.title,
    summary: incident.summary,
    openedAt: incident.openedAt,
    state: incident.state,
    organisations: incident.organisations,
    pendingMessages: incident.pendingMessages,
  };
}

export function openIncident(ctx: DemoContext): IncidentRecord | null {
  return ctx.state.incidents.find((incident) => incident.state === 'en_cours') ?? null;
}

export function santeApi(ctx: DemoContext): SanteApi {
  return {
    get: () => {
      const incident = openIncident(ctx);
      return Promise.resolve(
        santeSchema.parse({
          measuredAt: ctx.clock().toISOString(),
          availabilityBp: 9994,
          modulesOperational: MODULE_SEEDS.length - (incident?.moduleId ? 1 : 0),
          modulesTotal: MODULE_SEEDS.length,
          p95Ms: 184,
          p95TargetMs: 300,
          queuePending: QUEUES.reduce((sum, queue) => sum + queue.pending, 0),
          queueEmails: QUEUES.find((queue) => queue.id === 'emails')?.pending ?? 0,
          errors5xx: { failed: 41, total: 68_200 },
          services: SERVICES.map((service) => (incident === null && service.state === 'degraded' ? { ...service, state: 'operational', latencyMs: 8000 } : service)),
          queues: QUEUES.map((queue) => (incident === null && queue.slow ? { ...queue, slow: false, pending: 0, oldestSeconds: null } : queue)),
          database: {
            connections: { used: 64, max: 200 },
            diskGbTenths: { used: 384, max: 1000 },
            memoryPercent: 61,
            engine: 'MySQL 8.0, réplica actif',
            replicaLagMs: 200,
            slowQueries: 3,
            lastBackupAt: ctx.state.backups[0]?.at ?? '2026-11-13T03:00:00+01:00',
          },
          latency: LATENCY,
          incident: incident ? incidentSummary(incident) : null,
        }),
      );
    },

    incident: (id) => {
      const incident = findIncident(ctx, id);
      const end = incident.resolvedAt ? Date.parse(incident.resolvedAt) : ctx.clock().getTime();
      return Promise.resolve(
        incidentDetailSchema.parse({
          incident: {
            id: incident.id,
            code: incident.code,
            title: incident.title,
            state: incident.state,
            severity: incident.severity,
            openedAt: incident.openedAt,
            resolvedAt: incident.resolvedAt,
            owner: incident.owner,
            moduleId: incident.moduleId,
          },
          durationMinutes: Math.max(0, Math.round((end - Date.parse(incident.openedAt)) / 60_000)),
          metrics: incident.metrics,
          timeline: incident.timeline,
          communication: incident.communication,
          impacted: incident.impacted,
          runbook: incident.runbook,
        }),
      );
    },

    openIncident: (rawInput) => {
      const input = openIncidentInputSchema.parse(rawInput);
      if (input.moduleId !== '' && !MODULE_SEEDS.some((seed) => seed.id === input.moduleId)) throw new ConsoleError('invalid', 'Module inconnu.');
      const year = ctx.clock().getUTCFullYear();
      const number = ctx.state.incidents.length + 31;
      const code = `INC-${String(year)}-${String(number).padStart(3, '0')}`;
      const id = code.toLowerCase();
      const openedAt = ctx.clock().toISOString();
      ctx.state.incidents.unshift({
        id,
        code,
        title: input.title,
        summary: input.summary,
        state: 'en_cours',
        severity: Number(input.severity) as 1 | 2 | 3,
        openedAt,
        resolvedAt: null,
        owner: 'Lucas Bernard',
        moduleId: input.moduleId === '' ? null : input.moduleId,
        organisations: 0,
        pendingMessages: 0,
        metrics: [{ label: 'Sévérité', value: input.severity, caption: 'Évaluation initiale' }],
        timeline: [{ id: 'i1', at: openedAt, title: 'Incident ouvert', detail: `Sévérité ${input.severity} · Lucas Bernard` }],
        communication: null,
        impacted: [],
        runbook: input.moduleId === 'messagerie' ? RUNBOOK_01 : null,
      });
      ctx.audit.record({
        type: 'incident',
        title: `Incident ouvert, ${code}`,
        context: input.title,
        action: 'Ouverture d’incident',
        module: input.moduleId === '' ? 'Santé du système' : (MODULE_SEEDS.find((seed) => seed.id === input.moduleId)?.name ?? null),
        request: 'POST /api/console/incidents',
        after: { Sévérité: input.severity, Titre: input.title },
      });
      return Promise.resolve({ id });
    },

    addNote: (id, rawInput) => {
      const input = incidentNoteInputSchema.parse(rawInput);
      const incident = findIncident(ctx, id);
      incident.timeline.push({ id: `i${String(incident.timeline.length + 1)}`, at: ctx.clock().toISOString(), title: 'Note ajoutée', detail: `${input.text} · Lucas Bernard` });
      ctx.audit.record({ type: 'incident', title: `Note ajoutée, ${incident.code}`, context: input.text, action: 'Ajout d’une note', module: 'Santé du système', request: `POST /api/console/incidents/${id}/notes` });
      return Promise.resolve();
    },

    publishUpdate: (id, rawInput) => {
      const input = incidentUpdateInputSchema.parse(rawInput);
      const incident = findIncident(ctx, id);
      if (incident.state === 'resolu') throw new ConsoleError('conflict', 'Cet incident est résolu.');
      const at = ctx.clock().toISOString();
      incident.communication = {
        publishedAt: at,
        message: input.message,
        diffusion: `Bandeau, ${String(incident.organisations)} organisations`,
        nextUpdate: input.nextUpdate === '' ? 'Non planifié' : input.nextUpdate,
      };
      incident.timeline.push({ id: `i${String(incident.timeline.length + 1)}`, at, title: 'Mise à jour publiée', detail: `Bandeau dans l'application · Lucas Bernard` });
      ctx.audit.record({ type: 'incident', title: `Mise à jour publiée, ${incident.code}`, context: input.message, action: 'Publication', module: 'Santé du système', request: `POST /api/console/incidents/${id}/communication` });
      return Promise.resolve();
    },

    resolveIncident: (id) => {
      const incident = findIncident(ctx, id);
      if (incident.state === 'resolu') throw new ConsoleError('conflict', 'Cet incident est déjà résolu.');
      const at = ctx.clock().toISOString();
      incident.state = 'resolu';
      incident.resolvedAt = at;
      incident.timeline.push({ id: `i${String(incident.timeline.length + 1)}`, at, title: 'Incident résolu', detail: 'Retour à la normale · Lucas Bernard', tone: 'success' });
      ctx.audit.record({ type: 'incident', title: `Incident résolu, ${incident.code}`, context: incident.title, action: 'Résolution', module: 'Santé du système', request: `POST /api/console/incidents/${id}/resolution` });
      return Promise.resolve();
    },
  };
}
