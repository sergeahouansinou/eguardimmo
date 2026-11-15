'use client';

import { DEMO_NOW, createSourceContext, nextId, useScreenQuery, useSourceMutation } from '../../outils/kit';
import { addDays, isoDay } from '../shared/dates';
import { DEMO_EXPORT_USER, demoExportRequests } from './demo';
import { exportRequestInputSchema, exportRequestsSchema } from './schemas';
import type { ExportRequest, ExportRequestInput } from './schemas';

export interface ExportSource {
  listRequests: () => Promise<ExportRequest[]>;
  requestExport: (input: ExportRequestInput) => Promise<ExportRequest>;
  downloadArchive: (id: string) => Promise<{ filename: string; content: string; type: string }>;
}

const BYTES_PER_SCOPE = 96_000;

export function createDemoExportSource(): ExportSource {
  let requests = demoExportRequests();
  const listed = new Set<string>();

  return {
    listRequests: () => {
      requests = requests.map((item) => {
        if (item.status !== 'en_preparation') return item;
        if (!listed.has(item.id)) {
          listed.add(item.id);
          return item;
        }
        return { ...item, status: 'prete' };
      });
      return Promise.resolve(structuredClone(requests));
    },
    requestExport: (input) => {
      const parsed = exportRequestInputSchema.safeParse(input);
      if (!parsed.success) return Promise.reject(new Error('Demande d’export invalide'));
      const created: ExportRequest = {
        ...parsed.data,
        id: nextId('exp'),
        requestedAt: DEMO_NOW,
        requestedBy: DEMO_EXPORT_USER,
        status: 'en_preparation',
        expiresAt: `${addDays(isoDay(DEMO_NOW), 14)}T10:02:00+01:00`,
        sizeBytes: parsed.data.scopes.length * BYTES_PER_SCOPE,
      };
      requests = [created, ...requests];
      return Promise.resolve(structuredClone(created));
    },
    downloadArchive: (id) => {
      const found = requests.find((item) => item.id === id);
      if (!found) return Promise.reject(new Error('Demande introuvable'));
      if (found.status !== 'prete') return Promise.reject(new Error('Archive indisponible'));
      const manifest = {
        demonstration: true,
        demande: found.id,
        perimetre: found.scopes,
        periode: found.period,
        format: found.format,
        note: 'Archive simulée : aucune donnée réelle n’est incluse.',
      };
      const content =
        found.format === 'json'
          ? `${JSON.stringify(manifest, null, 2)}\n`
          : `\uFEFFrubrique;periode;format\r\n${found.scopes.map((scope) => `${scope};${found.period};${found.format}`).join('\r\n')}\r\n`;
      return Promise.resolve({
        filename: `eguardimmo-export-${found.id}.${found.format}`,
        content,
        type: found.format === 'json' ? 'application/json' : 'text/csv;charset=utf-8',
      });
    },
  };
}

const context = createSourceContext<ExportSource>(createDemoExportSource);

export const ExportSourceProvider = context.Provider;
export const useExportSource = context.useSource;
export const resetExportDemo = context.resetDefault;

export const exportKeys = { requests: ['compte', 'export', 'demandes'] as const };

export function useExportRequests() {
  const source = useExportSource();
  return useScreenQuery(exportKeys.requests, () => source.listRequests(), exportRequestsSchema);
}

export function useRequestExport() {
  const source = useExportSource();
  return useSourceMutation((input: ExportRequestInput) => source.requestExport(input), [exportKeys.requests]);
}
