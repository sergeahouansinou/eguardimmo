'use client';

import { useCallback } from 'react';
import { useRemarkPhoto } from './hooks';
import type { RemarkPhoto } from './model';

function PhotoImage({ blob, label }: { blob: Blob; label: string }) {
  const attach = useCallback(
    (node: HTMLImageElement | null) => {
      if (node === null) return undefined;
      const url = URL.createObjectURL(blob);
      node.src = url;
      return () => {
        URL.revokeObjectURL(url);
      };
    },
    [blob],
  );
  return <img ref={attach} alt={label} className="size-20 rounded-md border border-line object-cover" />;
}

function Photo({ photo }: { photo: RemarkPhoto }) {
  const file = useRemarkPhoto(photo.id);
  const label = `Photo ${String(photo.position + 1)} de la remarque`;
  if (file.isError) return <span className="text-caption text-fg-danger">{`${label} indisponible`}</span>;
  if (file.data === undefined) return <span role="status" aria-label={`${label} en cours de chargement`} className="block size-20 animate-pulse rounded-md bg-muted" />;
  return <PhotoImage blob={file.data} label={label} />;
}

export function RemarkPhotos({ photos }: { photos: readonly RemarkPhoto[] }) {
  if (photos.length === 0) return null;
  return (
    <ul aria-label="Photos de la remarque" className="flex flex-wrap gap-2">
      {[...photos].sort((first, second) => first.position - second.position).map((photo) => (
        <li key={photo.id}><Photo photo={photo} /></li>
      ))}
    </ul>
  );
}
