import { ConsoleError, matchesQuery, moduleDetailSchema, moduleListSchema, setFlagInputSchema } from '../../schemas';
import type { ModuleRow } from '../../schemas';
import type { ModulesApi } from '../../source';
import { MESSAGERIE_FLAGS, MODULE_LINKS, MODULE_SEEDS, ORGANISATIONS_TOTAL } from '../catalog';
import type { ModuleSeed } from '../catalog';
import { requireFound } from '../context';
import type { DemoContext } from '../context';

function degradedBy(ctx: DemoContext, seed: ModuleSeed): boolean {
  return ctx.state.incidents.some((incident) => incident.state === 'en_cours' && incident.moduleId === seed.id);
}

export function moduleRows(ctx: DemoContext): ModuleRow[] {
  return MODULE_SEEDS.map((seed) => ({
    id: seed.id,
    name: seed.name,
    description: seed.description,
    group: seed.group,
    version: seed.version,
    organisationsActive: seed.active,
    organisationsTotal: ORGANISATIONS_TOTAL,
    state: degradedBy(ctx, seed) ? 'degraded' : 'operational',
    mandatory: seed.mandatory ?? false,
    requires: seed.requires ?? [],
  }));
}

const flagState = (ctx: DemoContext, key: string, fallback: boolean): boolean => ctx.state.flags[key] ?? fallback;

export function modulesApi(ctx: DemoContext): ModulesApi {
  const seedOf = (id: string) => requireFound(MODULE_SEEDS.find((seed) => seed.id === id), 'Module');
  const rowOf = (id: string) => requireFound(moduleRows(ctx).find((row) => row.id === id), 'Module');

  return {
    list: (query) => {
      const rows = moduleRows(ctx).filter((row) => matchesQuery(query.q ?? '', row.name, row.description) && (!query.group || row.group === query.group));
      const filtered = rows.filter((row) => !query.tab || row.state === query.tab);
      const incident = ctx.state.incidents.find((candidate) => candidate.state === 'en_cours') ?? null;
      return Promise.resolve(
        moduleListSchema.parse({
          rows: filtered,
          counts: {
            all: rows.length,
            operational: rows.filter((row) => row.state === 'operational').length,
            degraded: rows.filter((row) => row.state === 'degraded').length,
          },
          deployedVersion: 'v3.18.2',
          deployedOn: '2026-11-10',
          degradedNames: moduleRows(ctx).filter((row) => row.state === 'degraded').map((row) => row.name),
          incident: incident
            ? { id: incident.id, code: incident.code, title: incident.title, openedAt: incident.openedAt, organisations: incident.organisations }
            : null,
        }),
      );
    },

    get: (id) => {
      const seed = seedOf(id);
      const row = rowOf(id);
      const incident = ctx.state.incidents.find((candidate) => candidate.state === 'en_cours' && candidate.moduleId === id) ?? null;
      const links = MODULE_LINKS[id] ?? { dependsOn: seed.mandatory ? [] : [{ id: 'authentification', detail: 'Identité des utilisateurs' }], usedBy: [] };
      const paused = ctx.state.pausedModules.has(id);
      const isMessagerie = id === 'messagerie';
      const older = previousVersions(seed.version);
      const flags = isMessagerie
        ? MESSAGERIE_FLAGS.map((flag) => ({ ...flag, enabled: flagState(ctx, flag.key, flag.enabled) }))
        : [
            { key: `${id}.actif`, label: `Module ${seed.name}`, detail: `${id}.actif`, enabled: flagState(ctx, `${id}.actif`, true), badge: null },
            { key: `${id}.nouveautes`, label: 'Nouveautés en préversion', detail: `${id}.nouveautes`, enabled: flagState(ctx, `${id}.nouveautes`, false), badge: null },
          ];
      const kpis = isMessagerie
        ? [
            { label: 'Disponibilité, 30 jours', value: '99,71 %', caption: 'Objectif : 99,9 %', tone: 'warning' as const },
            { label: "File d'envoi", value: '1 842', caption: 'messages en attente' },
            { label: 'Erreurs, 24 h', value: '0,8 %', caption: "24 échecs d'envoi, tous relancés" },
            { label: "Délai moyen d'envoi", value: paused ? 'Envois en pause' : '4 min 20 s', caption: 'Habituel : 8 secondes' },
          ]
        : [
            { label: 'Disponibilité, 30 jours', value: '99,98 %', caption: 'Objectif : 99,9 %' },
            { label: 'Organisations actives', value: `${String(seed.active)} sur ${String(ORGANISATIONS_TOTAL)}`, caption: 'avec le module activé' },
            { label: 'Erreurs, 24 h', value: '0,02 %', caption: 'Aucun échec persistant' },
            { label: 'Version déployée', value: seed.version, caption: 'Mise en production le 10/11/2026' },
          ];
      return Promise.resolve(
        moduleDetailSchema.parse({
          module: row,
          responsible: seed.responsible,
          provider: isMessagerie ? 'Relais SMTP principal' : 'Application Laravel',
          lastIncidentAt: isMessagerie ? '2026-11-13T20:42:00+01:00' : null,
          runbook: isMessagerie ? 'RUN-01, file d’envoi saturée' : null,
          kpis,
          flags,
          dependsOn: links.dependsOn.map((link) => ({
            id: link.id,
            name: seedOf(link.id).name,
            detail: link.detail,
            state: rowOf(link.id).state,
          })),
          usedBy: links.usedBy.map((link) => ({ id: link.id, name: seedOf(link.id).name, detail: link.detail, impacted: link.impacted && row.state === 'degraded' })),
          versions: [
            { version: seed.version, on: '2026-11-10', note: isMessagerie ? 'reprise après erreur' : 'correctifs de stabilité', current: true },
            { version: older[0], on: '2026-10-27', note: isMessagerie ? 'variables de campagne' : 'améliorations de performance', current: false },
            { version: older[1], on: '2026-10-13', note: isMessagerie ? 'suivi de lecture des campagnes' : 'nouvelles options', current: false },
          ],
          versionTotal: 12,
          incident: incident ? { id: incident.id, code: incident.code, openedAt: incident.openedAt, summary: incident.summary } : null,
          paused,
        }),
      );
    },

    setFlag: (id, rawInput) => {
      const input = setFlagInputSchema.parse(rawInput);
      const seed = seedOf(id);
      if (!input.key.startsWith(`${id}.`)) throw new ConsoleError('invalid', 'Ce drapeau n’appartient pas à ce module.');
      const previous = ctx.state.flags[input.key];
      ctx.state.flags[input.key] = input.enabled;
      ctx.audit.record({
        type: 'configuration',
        title: input.enabled ? `Drapeau activé, ${input.key}` : `Drapeau désactivé, ${input.key}`,
        context: `${seed.name}, ${input.key}`,
        action: input.enabled ? "Activation d'un drapeau" : "Désactivation d'un drapeau",
        module: seed.name,
        request: `PUT /api/console/modules/${id}/flags`,
        before: { [input.key]: previous === undefined ? 'Valeur par défaut' : previous ? 'Activé' : 'Désactivé' },
        after: { [input.key]: input.enabled ? 'Activé' : 'Désactivé' },
      });
      return Promise.resolve();
    },

    setPaused: (id, paused) => {
      const seed = seedOf(id);
      if (paused) ctx.state.pausedModules.add(id);
      else ctx.state.pausedModules.delete(id);
      ctx.audit.record({
        type: 'module',
        title: paused ? 'Envois mis en pause' : 'Envois repris',
        context: seed.name,
        action: paused ? 'Mise en pause' : 'Reprise',
        module: seed.name,
        request: `PUT /api/console/modules/${id}/pause`,
        after: { État: paused ? 'En pause' : 'Actif' },
      });
      return Promise.resolve();
    },
  };
}

function previousVersions(version: string): [string, string] {
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return [version, version];
  const major = match[1] ?? '0';
  let minor = Number(match[2]);
  let patch = Number(match[3]);
  const result: string[] = [];
  for (let step = 0; step < 2; step += 1) {
    if (patch > 0) patch -= 1;
    else {
      minor = Math.max(0, minor - 1);
      patch = 0;
    }
    result.push(`v${major}.${String(minor)}.${String(patch)}`);
  }
  return [result[0] ?? version, result[1] ?? version];
}
