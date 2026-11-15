import { z } from 'zod';
import { count, idSchema, isoDateSchema, isoDateTimeSchema } from './common';

export const backupKindSchema = z.enum(['quotidienne', 'mensuelle']);
export type BackupKind = z.infer<typeof backupKindSchema>;

export const backupSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  at: isoDateTimeSchema,
  kind: backupKindSchema,
  sizeMb: count,
  durationMinutes: count,
  success: z.boolean(),
});
export type Backup = z.infer<typeof backupSchema>;

export const restoreScopeSchema = z.enum(['base_documents', 'base', 'documents']);
export const restoreTargetSchema = z.enum(['isole', 'production']);
export const RESTORE_SCOPE_LABELS = {
  base_documents: 'Base de données et documents',
  base: 'Base de données seule',
  documents: 'Documents seuls',
} as const;
export const RESTORE_TARGET_LABELS = { isole: 'Environnement isolé', production: 'Production' } as const;

export const restoreRequestSchema = z.object({
  id: idSchema,
  backupId: idSchema,
  backupName: z.string(),
  scope: restoreScopeSchema,
  target: restoreTargetSchema,
  reason: z.string(),
  ticket: z.string().nullable(),
  requestedBy: z.string(),
  validator: z.string(),
  requestedAt: isoDateTimeSchema,
  state: z.enum(['en_attente']),
});
export type RestoreRequest = z.infer<typeof restoreRequestSchema>;

export const sauvegardesSchema = z.object({
  latest: backupSchema,
  total: count,
  retentionDays: count,
  usedGb: count,
  quotaGb: count,
  backups: z.array(backupSchema),
  tests: z.array(
    z.object({ id: idSchema, on: isoDateSchema, durationMinutes: count, detail: z.string(), success: z.boolean() }),
  ),
  lastTest: z.object({ on: isoDateSchema, durationMinutes: count }),
  nextTestOn: isoDateSchema,
  runbook: z.string(),
  requests: z.array(restoreRequestSchema),
});
export type Sauvegardes = z.infer<typeof sauvegardesSchema>;

export const restoreFormSchema = z.object({
  backupId: idSchema,
  scope: restoreScopeSchema,
  target: restoreTargetSchema,
  reason: z.string().trim().min(10, 'Le motif doit comporter au moins 10 caractères.').max(500),
  ticket: z
    .string()
    .trim()
    .refine((value) => value === '' || /^SUP-\d{3,6}$/.test(value), 'Référence attendue : SUP-2094.'),
  validatorId: idSchema,
});
export type RestoreFormInput = z.input<typeof restoreFormSchema>;

export const restoreRequestInputSchema = restoreFormSchema.extend({
  confirmation: z.string().min(1),
});
export type RestoreRequestInput = z.input<typeof restoreRequestInputSchema>;
