import { z } from 'zod';
import { count, idSchema, isoDateSchema, isoDateTimeSchema, toneSchema } from './common';

export const moduleGroupSchema = z.enum(['socle', 'gestion', 'suivi', 'pilotage']);
export type ModuleGroup = z.infer<typeof moduleGroupSchema>;
export const moduleStateSchema = z.enum(['operational', 'degraded']);
export type ModuleState = z.infer<typeof moduleStateSchema>;

export const MODULE_GROUP_LABELS: Record<ModuleGroup, string> = {
  socle: 'Socle',
  gestion: 'Gestion locative',
  suivi: 'Suivi',
  pilotage: 'Pilotage',
};

export const moduleRowSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  group: moduleGroupSchema,
  version: z.string().regex(/^v\d+\.\d+\.\d+$/),
  organisationsActive: count,
  organisationsTotal: count,
  state: moduleStateSchema,
  mandatory: z.boolean(),
  requires: z.array(idSchema).default([]),
});
export type ModuleRow = z.infer<typeof moduleRowSchema>;

export const moduleListSchema = z.object({
  rows: z.array(moduleRowSchema),
  counts: z.object({ all: count, operational: count, degraded: count }),
  deployedVersion: z.string(),
  deployedOn: isoDateSchema,
  degradedNames: z.array(z.string()),
  incident: z.object({ id: idSchema, code: z.string(), title: z.string(), openedAt: isoDateTimeSchema, organisations: count }).nullable(),
});
export type ModuleList = z.infer<typeof moduleListSchema>;

export const moduleDetailSchema = z.object({
  module: moduleRowSchema,
  responsible: z.string(),
  provider: z.string(),
  lastIncidentAt: isoDateTimeSchema.nullable(),
  runbook: z.string().nullable(),
  kpis: z.array(z.object({ label: z.string(), value: z.string(), caption: z.string(), tone: toneSchema.optional() })),
  flags: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      detail: z.string(),
      enabled: z.boolean(),
      badge: z.object({ label: z.string(), tone: toneSchema }).nullable(),
    }),
  ),
  dependsOn: z.array(z.object({ id: idSchema, name: z.string(), detail: z.string(), state: moduleStateSchema })),
  usedBy: z.array(z.object({ id: idSchema, name: z.string(), detail: z.string(), impacted: z.boolean() })),
  versions: z.array(z.object({ version: z.string(), on: isoDateSchema, note: z.string(), current: z.boolean() })),
  versionTotal: count,
  incident: z.object({ id: idSchema, code: z.string(), openedAt: isoDateTimeSchema, summary: z.string() }).nullable(),
  paused: z.boolean(),
});
export type ModuleDetail = z.infer<typeof moduleDetailSchema>;

export const organisationModulesSchema = z.object({
  organisation: z.object({ id: idSchema, name: z.string() }),
  total: count,
  enabled: count,
  groups: z.array(
    z.object({
      group: moduleGroupSchema,
      label: z.string(),
      modules: z.array(
        z.object({
          id: idSchema,
          name: z.string(),
          description: z.string(),
          mandatory: z.boolean(),
          enabled: z.boolean(),
          degraded: z.boolean(),
          requires: z.array(idSchema),
        }),
      ),
    }),
  ),
});
export type OrganisationModules = z.infer<typeof organisationModulesSchema>;

export const setOrganisationModulesInputSchema = z.object({ enabledIds: z.array(idSchema) });
export type SetOrganisationModulesInput = z.infer<typeof setOrganisationModulesInputSchema>;

export const setFlagInputSchema = z.object({ key: z.string().min(1), enabled: z.boolean() });
export type SetFlagInput = z.infer<typeof setFlagInputSchema>;
