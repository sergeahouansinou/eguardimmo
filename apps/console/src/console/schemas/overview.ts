import { z } from 'zod';
import { count, idSchema, isoDateSchema, isoDateTimeSchema } from './common';
import { auditTypeSchema } from './audit';
import { moduleStateSchema } from './modules';
import { rgpdTypeSchema } from './rgpd';
import { incidentSummarySchema } from './sante';

export const overviewSchema = z.object({
  generatedAt: isoDateTimeSchema,
  moduleCount: count,
  incident: incidentSummarySchema.nullable(),
  organisations: z.object({
    total: count,
    actives: count,
    essais: count,
    suspendues: count,
    bailleurs: count,
    agences: count,
    proprietaires: count,
  }),
  accounts: z.object({ total: count, profiles: count }),
  availabilityBp: count,
  modulesOperational: count,
  rgpd: z.object({
    pending: count,
    rows: z.array(
      z.object({ id: idSchema, requester: z.string(), type: rgpdTypeSchema, receivedOn: isoDateSchema, dueOn: isoDateSchema }),
    ),
  }),
  modules: z.array(z.object({ id: idSchema, name: z.string(), description: z.string(), state: moduleStateSchema })),
  audit: z.object({
    total: count,
    rows: z.array(
      z.object({ id: idSchema, type: auditTypeSchema, title: z.string(), context: z.string(), at: isoDateTimeSchema }),
    ),
  }),
});
export type Overview = z.infer<typeof overviewSchema>;
