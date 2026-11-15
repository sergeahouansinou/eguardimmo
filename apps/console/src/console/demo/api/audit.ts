import { auditDetailSchema, auditListSchema, auditQuerySchema, exportAuditResultSchema, paginate } from '../../schemas';
import type { AuditEvent } from '../../schemas';
import { AUDIT_TYPE_LABELS, matchesQuery } from '../../schemas';
import type { AuditApi } from '../../source';
import { dayKey } from '@/lib/format';
import { requireFound } from '../context';
import type { DemoContext } from '../context';

type Filters = ReturnType<typeof auditQuerySchema.parse>;

function filterEvents(events: readonly AuditEvent[], filters: Filters): AuditEvent[] {
  return events
    .filter(
      (event) =>
        matchesQuery(filters.q, event.title, event.context, event.actor.name, event.organisationName ?? '', event.reference) &&
        (filters.type === '' || event.type === filters.type) &&
        (filters.organisationId === '' || event.organisationId === filters.organisationId) &&
        (filters.from === '' || dayKey(event.at) >= filters.from) &&
        (filters.to === '' || dayKey(event.at) <= filters.to) &&
        (!filters.justifiedOnly || event.justified),
    )
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at) || right.reference.localeCompare(left.reference));
}

function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function auditApi(ctx: DemoContext): AuditApi {
  return {
    list: (rawQuery) => {
      const filters = auditQuerySchema.parse(rawQuery);
      const events = filterEvents(ctx.audit.events, filters);
      const organisations = ctx.state.orgs
        .map((org) => ({ id: org.id, name: org.name }))
        .sort((left, right) => left.name.localeCompare(right.name, 'fr'));
      return Promise.resolve(
        auditListSchema.parse({
          ...paginate(events, filters.page, filters.pageSize),
          organisations,
        }),
      );
    },

    get: (id) => {
      const event = requireFound(ctx.audit.events.find((candidate) => candidate.id === id), 'Événement');
      return Promise.resolve(auditDetailSchema.parse({ event, integrity: { intact: true, verifiedAt: ctx.clock().toISOString() } }));
    },

    export: (rawQuery) => {
      const filters = auditQuerySchema.parse({ ...rawQuery, page: 1, pageSize: 100 });
      const events = filterEvents(ctx.audit.events, filters);
      const header = ['Référence', 'Date', 'Acteur', 'Rôle', 'Type', 'Action', 'Contexte', 'Origine', 'Organisation'];
      const lines = events.map((event) =>
        [event.reference, event.at, event.actor.name, event.actor.role, AUDIT_TYPE_LABELS[event.type], event.title, event.context, event.origin, event.organisationName ?? ''].map(csvCell).join(';'),
      );
      ctx.audit.record({
        type: 'export',
        title: 'Export du journal d’audit',
        context: `${String(events.length)} événements`,
        action: 'Export',
        module: "Journal d'audit",
        request: 'GET /api/console/audit/export',
        after: { Événements: String(events.length) },
      });
      return Promise.resolve(
        exportAuditResultSchema.parse({
          filename: `journal-audit-${dayKey(ctx.clock().toISOString())}.csv`,
          csv: [header.join(';'), ...lines].join('\n'),
          rows: events.length,
        }),
      );
    },
  };
}
