'use client';

import { Badge, IconButton, TableCell, TableRow } from '@eguardimmo/ui';
import { Archive, ArchiveRestore, Download } from 'lucide-react';
import { formatDateFr } from '../../locataires/kit/dates';
import { formatSize, isReadable, libraryKindLabel, scanBadge } from './labels';
import type { LibraryEntry } from './model';

export interface LibraryRowProps {
  entry: LibraryEntry;
  subjectLabel: string;
  canWrite: boolean;
  onDownload: (entry: LibraryEntry) => void;
  onArchive: (entry: LibraryEntry) => void;
  onRestore: (entry: LibraryEntry) => void;
}

export function LibraryRow({ entry, subjectLabel, canWrite, onDownload, onArchive, onRestore }: LibraryRowProps) {
  const scan = scanBadge[entry.file.scanStatus];
  return (
    <TableRow>
      <TableCell strong>
        <span className="block min-w-0 [overflow-wrap:anywhere]">{entry.file.name}</span>
        <span className="text-caption font-normal text-fg-subtle">{formatSize(entry.file.sizeBytes)}</span>
        <span className="mt-1 flex items-center gap-1">
          {isReadable(entry.file.scanStatus) ? <IconButton label={`Télécharger ${entry.file.name}`} icon={Download} onClick={() => { onDownload(entry); }} /> : null}
          {canWrite && !entry.archived ? <IconButton label={`Archiver ${entry.file.name}`} icon={Archive} onClick={() => { onArchive(entry); }} /> : null}
          {canWrite && entry.archived ? <IconButton label={`Restaurer ${entry.file.name}`} icon={ArchiveRestore} onClick={() => { onRestore(entry); }} /> : null}
        </span>
      </TableCell>
      <TableCell>{libraryKindLabel[entry.kind]}</TableCell>
      <TableCell>{subjectLabel}</TableCell>
      <TableCell>{formatDateFr(entry.createdAt.slice(0, 10))}</TableCell>
      <TableCell>
        <Badge tone={scan.tone}>{scan.label}</Badge>
        {scan.hint === null ? null : <span className="mt-0.5 block max-w-[260px] text-caption text-fg-subtle">{scan.hint}</span>}
      </TableCell>
    </TableRow>
  );
}
