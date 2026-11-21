'use client';

import { IconButton } from '@eguardimmo/ui';
import { Download, RefreshCw } from 'lucide-react';
import type { Certificate } from './model';

export const canRenew = (certificate: Certificate): boolean => certificate.replacedById === null;

export function CertificateActions({ certificate, canWrite, onDownload, onRenew }: { certificate: Certificate; canWrite: boolean; onDownload: (certificate: Certificate) => void; onRenew: (certificate: Certificate) => void }) {
  const name = `${certificate.type.label}${certificate.reference ? ` ${certificate.reference}` : ''}`;
  return (
    <span className="flex items-center gap-1">
      {certificate.storedFileId !== null ? <IconButton label={`Télécharger le justificatif, ${name}`} icon={Download} onClick={() => { onDownload(certificate); }} /> : null}
      {canWrite && canRenew(certificate) ? <IconButton label={`Renouveler, ${name}`} icon={RefreshCw} onClick={() => { onRenew(certificate); }} /> : null}
    </span>
  );
}
