'use client';

import { X } from 'lucide-react';
import { Alert, IconButton } from '@eguardimmo/ui';
import { formatSize } from './files';
import type { PickedFile, Rejection } from './files';

export function PickedFiles({ files, onRemove }: { files: readonly PickedFile[]; onRemove: (id: string) => void }) {
  if (files.length === 0) return null;
  return (
    <ul className="flex flex-col">
      {files.map((file) => (
        <li key={file.id} className="flex items-center gap-2 border-b border-line py-2 last:border-b-0">
          <div className="flex min-w-0 flex-1 flex-col">
            <b className="truncate text-body-strong text-fg">{file.name}</b>
            <span className="text-caption text-fg-subtle">{`${formatSize(file.sizeBytes)} · prêt`}</span>
          </div>
          <IconButton
            label={`Retirer le fichier ${file.name}`}
            icon={X}
            size="xs"
            onClick={() => {
              onRemove(file.id);
            }}
          />
        </li>
      ))}
    </ul>
  );
}

export function RejectedFiles({ rejected }: { rejected: readonly Rejection[] }) {
  if (rejected.length === 0) return null;
  return (
    <Alert tone="danger" title="Certains fichiers n’ont pas été ajoutés">
      <ul className="list-disc pl-4">
        {rejected.map((item, index) => (
          <li key={`${item.name}-${String(index)}`}>{`${item.name} : ${item.reason}`}</li>
        ))}
      </ul>
    </Alert>
  );
}
