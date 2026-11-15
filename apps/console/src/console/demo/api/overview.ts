import { overviewSchema } from '../../schemas';
import { MODULE_SEEDS } from '../catalog';
import type { DemoContext } from '../context';
import { moduleRows } from './modules';
import { sortedRgpdRows } from './rgpd';
import { incidentSummary, openIncident } from './sante';

export function overview(ctx: DemoContext): unknown {
  const orgs = ctx.state.orgs;
  const incident = openIncident(ctx);
  const pending = sortedRgpdRows(ctx).filter((row) => row.state === 'a_traiter');
  const rows = moduleRows(ctx);
  const recent = [...ctx.audit.events].sort((left, right) => Date.parse(right.at) - Date.parse(left.at)).slice(0, 3);
  const highlighted = ['authentification', 'baux', 'messagerie', 'documents', 'reversements', 'journal-d-audit'];
  return overviewSchema.parse({
    generatedAt: ctx.clock().toISOString(),
    moduleCount: MODULE_SEEDS.length,
    incident: incident ? incidentSummary(incident) : null,
    organisations: {
      total: orgs.length,
      actives: orgs.filter((org) => org.state === 'active').length,
      essais: orgs.filter((org) => org.state === 'essai').length,
      suspendues: orgs.filter((org) => org.state === 'suspendue').length,
      bailleurs: orgs.filter((org) => org.type === 'bailleur').length,
      agences: orgs.filter((org) => org.type === 'agence').length,
      proprietaires: orgs.filter((org) => org.type === 'proprietaire').length,
    },
    accounts: { total: ctx.state.accounts.length, profiles: ctx.state.accounts.reduce((sum, account) => sum + account.profiles.length, 0) },
    availabilityBp: 9994,
    modulesOperational: rows.filter((row) => row.state === 'operational').length,
    rgpd: {
      pending: pending.length,
      rows: pending.slice(0, 3).map((row) => ({ id: row.id, requester: row.requester, type: row.type, receivedOn: row.receivedOn, dueOn: row.dueOn })),
    },
    modules: highlighted.flatMap((id) => rows.filter((row) => row.id === id).map((row) => ({ id: row.id, name: row.name, description: row.description, state: row.state }))),
    audit: {
      total: ctx.audit.events.length,
      rows: recent.map((event) => ({ id: event.id, type: event.type, title: event.title, context: `${event.actor.name} · ${event.context}`, at: event.at })),
    },
  });
}
