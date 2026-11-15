'use client';

import { createSourceContext, useScreenQuery } from '../../outils/kit';
import type { ScreenQuery } from '../../outils/kit';
import { createDemoDocumentsSource } from './demo';
import { documentListSchema } from './schemas';
import type { DocumentInput, DocumentPatch, DocumentRecord } from './schemas';

export interface DocumentsSource {
  list: () => Promise<unknown>;
  createMany: (drafts: readonly DocumentInput[]) => Promise<void>;
  update: (id: string, patch: DocumentPatch) => Promise<unknown>;
  setShared: (ids: readonly string[], shared: boolean) => Promise<void>;
  setArchived: (ids: readonly string[], archived: boolean) => Promise<void>;
  remove: (ids: readonly string[]) => Promise<void>;
}

const context = createSourceContext(createDemoDocumentsSource);

export const DocumentsSourceProvider = context.Provider;
export const useDocumentsSource = context.useSource;
export const resetDocumentsDemo = context.resetDefault;

export const DOCUMENTS_KEY = ['suivi', 'documents'] as const;

export function useDocuments(): ScreenQuery<DocumentRecord[]> {
  const source = useDocumentsSource();
  return useScreenQuery(DOCUMENTS_KEY, source.list, documentListSchema);
}
