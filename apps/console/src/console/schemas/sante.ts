import { z } from 'zod';
import { count, idSchema, isoDateTimeSchema, toneSchema } from './common';
import { moduleStateSchema } from './modules';

export const serviceRowSchema = z.object({
  id: idSchema,
  name: z.string(),
  state: moduleStateSchema,
  latencyMs: count,
  availabilityBp: count,
});
export type ServiceRow = z.infer<typeof serviceRowSchema>;

export const queueRowSchema = z.object({
  id: idSchema,
  name: z.string(),
  pending: count,
  oldestSeconds: count.nullable(),
  slow: z.boolean(),
});
export type QueueRow = z.infer<typeof queueRowSchema>;

export const incidentSeveritySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export const incidentStateSchema = z.enum(['en_cours', 'resolu']);
export type IncidentState = z.infer<typeof incidentStateSchema>;

export const incidentSummarySchema = z.object({
  id: idSchema,
  code: z.string(),
  title: z.string(),
  summary: z.string(),
  openedAt: isoDateTimeSchema,
  state: incidentStateSchema,
  organisations: count,
  pendingMessages: count,
});
export type IncidentSummary = z.infer<typeof incidentSummarySchema>;

export const santeSchema = z.object({
  measuredAt: isoDateTimeSchema,
  availabilityBp: count,
  modulesOperational: count,
  modulesTotal: count,
  p95Ms: count,
  p95TargetMs: count,
  queuePending: count,
  queueEmails: count,
  errors5xx: z.object({ failed: count, total: count }),
  services: z.array(serviceRowSchema),
  queues: z.array(queueRowSchema),
  database: z.object({
    connections: z.object({ used: count, max: count }),
    diskGbTenths: z.object({ used: count, max: count }),
    memoryPercent: count,
    engine: z.string(),
    replicaLagMs: count,
    slowQueries: count,
    lastBackupAt: isoDateTimeSchema,
  }),
  latency: z.array(z.object({ label: z.string(), ms: count })),
  incident: incidentSummarySchema.nullable(),
});
export type Sante = z.infer<typeof santeSchema>;

export const incidentDetailSchema = z.object({
  incident: z.object({
    id: idSchema,
    code: z.string(),
    title: z.string(),
    state: incidentStateSchema,
    severity: incidentSeveritySchema,
    openedAt: isoDateTimeSchema,
    resolvedAt: isoDateTimeSchema.nullable(),
    owner: z.string(),
    moduleId: idSchema.nullable(),
  }),
  durationMinutes: count,
  metrics: z.array(z.object({ label: z.string(), value: z.string(), caption: z.string() })),
  timeline: z.array(
    z.object({ id: idSchema, at: isoDateTimeSchema, title: z.string(), detail: z.string(), tone: toneSchema.optional() }),
  ),
  communication: z
    .object({ publishedAt: isoDateTimeSchema, message: z.string(), diffusion: z.string(), nextUpdate: z.string() })
    .nullable(),
  impacted: z.array(z.object({ id: idSchema, name: z.string(), detail: z.string() })),
  runbook: z.object({ code: z.string(), title: z.string(), steps: z.array(z.string()) }).nullable(),
});
export type IncidentDetail = z.infer<typeof incidentDetailSchema>;

export const openIncidentInputSchema = z.object({
  title: z.string().trim().min(5, 'Le titre doit comporter au moins 5 caractères.').max(120),
  severity: z.enum(['1', '2', '3']),
  moduleId: z.string().default(''),
  summary: z.string().trim().min(10, 'Décrivez l’incident (10 caractères minimum).').max(500),
});
export type OpenIncidentInput = z.input<typeof openIncidentInputSchema>;

export const incidentNoteInputSchema = z.object({
  text: z.string().trim().min(5, 'La note doit comporter au moins 5 caractères.').max(500),
});
export type IncidentNoteInput = z.input<typeof incidentNoteInputSchema>;

export const incidentUpdateInputSchema = z.object({
  message: z.string().trim().min(10, 'Le message doit comporter au moins 10 caractères.').max(500),
  nextUpdate: z.string().trim().max(40),
});
export type IncidentUpdateInput = z.input<typeof incidentUpdateInputSchema>;
