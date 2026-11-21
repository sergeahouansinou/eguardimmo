'use client';

import { MissingSourceError, createSourceContext } from '../../locataires/kit/sourceContext';
import type { DownloadedFile } from '../model';
import type { LibraryEntry, LibraryPage, LibraryPermissions, LibraryQuery, NewLibraryDocument } from './model';

export interface LibrarySource {
  readonly permissions: LibraryPermissions;
  readonly organizationId: string | null;
  list: (query: LibraryQuery, cursor: string | null) => Promise<LibraryPage>;
  file: (document: NewLibraryDocument) => Promise<LibraryEntry>;
  archive: (entryId: string) => Promise<LibraryEntry>;
  restore: (entryId: string) => Promise<LibraryEntry>;
  downloadFile: (fileId: string) => Promise<DownloadedFile>;
}

const context = createSourceContext<LibrarySource>('Bibliothèque de documents', () => {
  throw new MissingSourceError('Bibliothèque de documents');
});

export const LibrarySourceProvider = context.SourceProvider;
export const useLibrarySource = context.useSource;
