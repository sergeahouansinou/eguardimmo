import { z } from 'zod';
import { count, idSchema, isoDateSchema, isoDateTimeSchema, pageOf, toneSchema } from './common';

export const auditTypeSchema = z.enum([
  'connexion',
  'configuration',
  'droits',
  'export',
  'securite',
  'rgpd',
  'acces_justifie',
  'organisation',
  'compte',
  'module',
  'abonnement',
  'sauvegarde',
  'incident',
  'equipe',
]);
export type AuditType = z.infer<typeof auditTypeSchema>;

export const AUDIT_TYPE_LABELS: Record<AuditType, string> = {
  connexion: 'Connexion',
  configuration: 'Configuration',
  droits: 'Droits',
  export: 'Export',
  securite: 'Sécurité',
  rgpd: 'RGPD',
  acces_justifie: 'Accès justifié',
  organisation: 'Organisation',
  compte: 'Compte',
  module: 'Module',
  abonnement: 'Abonnement',
  sauvegarde: 'Sauvegarde',
  incident: 'Incident',
  equipe: 'Équipe',
};

export const AUDIT_TYPE_TONES: Record<AuditType, z.infer<typeof toneSchema>> = {
  connexion: 'neutral',
  configuration: 'neutral',
  droits: 'warning',
  export: 'info',
  securite: 'danger',
  rgpd: 'info',
  acces_justifie: 'warning',
  organisation: 'neutral',
  compte: 'neutral',
  module: 'neutral',
  abonnement: 'neutral',
  sauvegarde: 'warning',
  incident: 'warning',
  equipe: 'warning',
};

export const auditEventSchema = z.object({
  id: idSchema,
  reference: z.string().regex(/^EVT-\d{4}-\d{6}$/),
  at: isoDateTimeSchema,
  actor: z.object({ name: z.string().min(1), role: z.string().min(1) }),
  type: auditTypeSchema,
  title: z.string().min(1),
  context: z.string(),
  origin: z.string(),
  organisationId: idSchema.nullable(),
  organisationName: z.string().nullable(),
  resource: z.string().nullable(),
  module: z.string().nullable(),
  request: z.string().nullable(),
  action: z.string(),
  before: z.record(z.string(), z.string()).nullable(),
  after: z.record(z.string(), z.string()).nullable(),
  device: z.string(),
  session: z.string(),
  justified: z.boolean(),
  hash: z.string().min(8),
  previousHash: z.string().min(8),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const auditRowSchema = auditEventSchema.pick({
  id: true,
  reference: true,
  at: true,
  actor: true,
  type: true,
  title: true,
  context: true,
  origin: true,
  organisationId: true,
});
export type AuditRow = z.infer<typeof auditRowSchema>;

export const auditListSchema = pageOf(auditRowSchema).extend({
  organisations: z.array(z.object({ id: idSchema, name: z.string() })),
});
export type AuditList = z.infer<typeof auditListSchema>;

export const auditQuerySchema = z.object({
  q: z.string().trim().max(120).default(''),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(7),
  type: z.union([auditTypeSchema, z.literal('')]).default(''),
  organisationId: z.string().default(''),
  from: z.union([isoDateSchema, z.literal('')]).default(''),
  to: z.union([isoDateSchema, z.literal('')]).default(''),
  justifiedOnly: z.boolean().default(false),
});
export type AuditQuery = z.input<typeof auditQuerySchema>;

export const auditDetailSchema = z.object({
  event: auditEventSchema,
  integrity: z.object({ intact: z.boolean(), verifiedAt: isoDateTimeSchema }),
});
export type AuditDetail = z.infer<typeof auditDetailSchema>;

export const exportAuditInputSchema = auditQuerySchema.omit({ page: true, pageSize: true });
export const exportAuditResultSchema = z.object({ filename: z.string(), csv: z.string(), rows: count });
export type ExportAuditResult = z.infer<typeof exportAuditResultSchema>;
