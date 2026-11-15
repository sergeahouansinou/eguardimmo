import { z } from 'zod';

export const EXPORT_SCOPES = ['biens', 'locataires', 'baux', 'finances', 'documents', 'messages'] as const;
export type ExportScope = (typeof EXPORT_SCOPES)[number];

export const EXPORT_SCOPE_LABELS: Record<ExportScope, { label: string; detail: string }> = {
  biens: { label: 'Biens et immeubles', detail: '12 biens, équipements et relevés de compteurs' },
  locataires: { label: 'Locataires et candidats', detail: '9 locataires, coordonnées et pièces du dossier' },
  baux: { label: 'Baux et états des lieux', detail: '11 baux, avenants et états des lieux' },
  finances: { label: 'Finances', detail: 'Loyers, quittances, dépenses, prêts et bilans' },
  documents: { label: 'Documents', detail: 'Quittances, courriers et documents signés' },
  messages: { label: 'Messages', detail: 'Conversations et campagnes envoyées' },
};

export const EXPORT_FORMATS = ['csv', 'json'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = { csv: 'CSV (tableur)', json: 'JSON (structuré)' };

export const EXPORT_PERIODS = ['all', 'year2026', 'year2025'] as const;
export type ExportPeriod = (typeof EXPORT_PERIODS)[number];
export const EXPORT_PERIOD_LABELS: Record<ExportPeriod, string> = {
  all: 'Tout l’historique',
  year2026: 'Année 2026',
  year2025: 'Année 2025',
};

export const EXPORT_STATUSES = ['en_preparation', 'prete', 'expiree'] as const;
export type ExportStatus = (typeof EXPORT_STATUSES)[number];
export const EXPORT_STATUS_LABELS: Record<ExportStatus, string> = {
  en_preparation: 'En préparation',
  prete: 'Prête',
  expiree: 'Expirée',
};

export const exportRequestInputSchema = z.object({
  scopes: z.array(z.enum(EXPORT_SCOPES)).min(1, 'Choisissez au moins un type de données'),
  format: z.enum(EXPORT_FORMATS),
  period: z.enum(EXPORT_PERIODS),
});
export type ExportRequestInput = z.infer<typeof exportRequestInputSchema>;

export const exportRequestSchema = exportRequestInputSchema.extend({
  id: z.string().min(1),
  requestedAt: z.iso.datetime({ offset: true }),
  requestedBy: z.string().min(1),
  status: z.enum(EXPORT_STATUSES),
  expiresAt: z.iso.datetime({ offset: true }),
  sizeBytes: z.number().int().nonnegative(),
});
export type ExportRequest = z.infer<typeof exportRequestSchema>;
export const exportRequestsSchema = z.array(exportRequestSchema);
