'use client';

import { useRef, useState } from 'react';
import { FilePicker } from '../../locataires/kit';
import { MAX_FILE_BYTES } from '../api/maintenancePayloads';
import { useMaintenanceMutation } from '../hooks';
import type { FileKind } from '../model';

const ACCEPT = 'application/pdf,image/jpeg,image/png';
const TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export const validateAttachment = (file: File): string | null => {
  if (!TYPES.includes(file.type)) return 'Format non accepté : choisissez un PDF, un JPEG ou un PNG.';
  if (file.size > MAX_FILE_BYTES) return 'La pièce dépasse 10 Mo.';
  return null;
};

export function useAttachment(interventionId: string, kind: FileKind, visibleToOwner = false) {
  const upload = useMaintenanceMutation((source, file: File) => source.uploadFile(interventionId, { file, kind, visibleToOwner, visibleToTenant: false }));
  const [file, setFile] = useState<File | null>(null);
  const uploaded = useRef<{ file: File; id: string } | null>(null);

  const ensureUploaded = async (): Promise<string | null> => {
    if (file === null) return null;
    if (uploaded.current?.file === file) return uploaded.current.id;
    const id = await upload.mutateAsync(file);
    uploaded.current = { file, id };
    return id;
  };

  return { file, setFile, ensureUploaded };
}

export function AttachmentField({ label, hint, file, onFile, error }: { label: string; hint: string; file: File | null; onFile: (file: File | null) => void; error?: string }) {
  return <FilePicker label={label} hint={hint} accept={ACCEPT} validate={validateAttachment} file={file} onFile={onFile} error={error} />;
}
