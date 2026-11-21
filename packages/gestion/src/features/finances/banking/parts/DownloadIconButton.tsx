'use client';

import { IconButton } from '@eguardimmo/ui';
import { FileDown } from 'lucide-react';
import { useDownload } from '../hooks';
import { saveBlob } from '../../rent/download';
import { errorMessage, useNotify } from '../../../locataires/kit';

export function DownloadIconButton({ load, filename, label, failureTitle }: { load: () => Promise<Blob>; filename: string; label: string; failureTitle: string }) {
  const download = useDownload();
  const notify = useNotify();
  return (
    <IconButton
      label={label}
      icon={FileDown}
      disabled={download.isPending}
      onClick={() => {
        download.mutate(load, {
          onSuccess: (blob) => { saveBlob(blob, filename); },
          onError: (error) => { notify({ tone: 'danger', title: failureTitle, description: errorMessage(error) }); },
        });
      }}
    />
  );
}
