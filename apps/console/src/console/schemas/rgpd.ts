import { z } from 'zod';
import { count, idSchema, isoDateSchema, isoDateTimeSchema, pageOf } from './common';

export const rgpdTypeSchema = z.enum(['acces', 'effacement', 'rectification']);
export type RgpdType = z.infer<typeof rgpdTypeSchema>;
export const rgpdStateSchema = z.enum(['a_traiter', 'en_cours', 'cloturee']);
export type RgpdState = z.infer<typeof rgpdStateSchema>;

export const RGPD_TYPE_LABELS: Record<RgpdType, string> = {
  acces: "Demande d'accès",
  effacement: "Demande d'effacement",
  rectification: 'Demande de rectification',
};
export const RGPD_STATE_LABELS: Record<RgpdState, string> = {
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  cloturee: 'Clôturée',
};

export const rgpdStepSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  actionLabel: z.string().min(1),
  strong: z.boolean(),
  doneOn: isoDateSchema.nullable(),
  detail: z.string().nullable(),
});
export type RgpdStep = z.infer<typeof rgpdStepSchema>;

export const rgpdRowSchema = z.object({
  id: idSchema,
  requester: z.string(),
  type: rgpdTypeSchema,
  organisationId: idSchema,
  organisationName: z.string(),
  receivedOn: isoDateSchema,
  dueOn: isoDateSchema,
  closedOn: isoDateSchema.nullable(),
  state: rgpdStateSchema,
  daysLeft: z.number().int().nullable(),
});
export type RgpdRow = z.infer<typeof rgpdRowSchema>;

export const rgpdListSchema = pageOf(rgpdRowSchema).extend({
  counts: z.object({ all: count, a_traiter: count, en_cours: count, cloturee: count }),
  stats: z.object({
    toProcess: count,
    nearestDue: isoDateSchema.nullable(),
    inProgress: count,
    closed: count,
    averageDays: count,
  }),
  organisations: z.array(z.object({ id: idSchema, name: z.string() })),
});
export type RgpdList = z.infer<typeof rgpdListSchema>;

export const rgpdQuerySchema = z.object({
  q: z.string().trim().max(120).default(''),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(6),
  state: z.union([rgpdStateSchema, z.literal('')]).default(''),
  type: z.union([rgpdTypeSchema, z.literal('')]).default(''),
  organisationId: z.string().default(''),
});
export type RgpdQuery = z.input<typeof rgpdQuerySchema>;

export const rgpdDetailSchema = z.object({
  request: rgpdRowSchema,
  profile: z.string(),
  channel: z.string(),
  email: z.email(),
  steps: z.array(rgpdStepSchema),
  scope: z.array(z.object({ id: idSchema, title: z.string(), detail: z.string(), action: z.enum(['effacer', 'conserver', 'exporter', 'corriger']) })),
  timeline: z.array(z.object({ id: idSchema, date: isoDateSchema, title: z.string(), detail: z.string() })),
  messages: z.array(z.object({ id: idSchema, at: isoDateTimeSchema, text: z.string() })),
  nextStep: rgpdStepSchema.nullable(),
});
export type RgpdDetail = z.infer<typeof rgpdDetailSchema>;

export const clarificationInputSchema = z.object({
  message: z.string().trim().min(10, 'Le message doit comporter au moins 10 caractères.').max(1000),
});
export type ClarificationInput = z.input<typeof clarificationInputSchema>;
