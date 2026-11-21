'use client';

import { saveBlob } from '../finances/rent/download';
import { errorMessage, useNotify } from '../locataires/kit';
import { downloadName } from './files';
import { useFileDownload } from './hooks';
import type { Certificate } from './model';

export function useCertificateDownload() {
  const download = useFileDownload();
  const notify = useNotify();
  return async (certificate: Pick<Certificate, 'storedFileId' | 'type' | 'reference'>) => {
    if (certificate.storedFileId === null) return;
    try {
      const { blob, mimeType } = await download.mutateAsync(certificate.storedFileId);
      saveBlob(blob, downloadName([certificate.type.label, certificate.reference], mimeType));
    } catch (error) {
      notify({ tone: 'danger', title: 'Téléchargement impossible', description: errorMessage(error) });
    }
  };
}
