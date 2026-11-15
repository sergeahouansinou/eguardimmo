import type { ExportRequest } from './schemas';

export const DEMO_EXPORT_USER = 'Awa Diallo';

export function demoExportRequests(): ExportRequest[] {
  return [
    {
      id: 'exp-2026-11-02',
      requestedAt: '2026-11-02T09:14:00+01:00',
      requestedBy: DEMO_EXPORT_USER,
      scopes: ['biens', 'locataires', 'baux'],
      format: 'csv',
      period: 'all',
      status: 'prete',
      expiresAt: '2026-11-16T09:14:00+01:00',
      sizeBytes: 482_304,
    },
    {
      id: 'exp-2026-09-18',
      requestedAt: '2026-09-18T16:40:00+02:00',
      requestedBy: DEMO_EXPORT_USER,
      scopes: ['finances', 'documents'],
      format: 'json',
      period: 'year2026',
      status: 'expiree',
      expiresAt: '2026-10-02T16:40:00+02:00',
      sizeBytes: 2_411_520,
    },
  ];
}
