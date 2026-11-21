'use client';

import { Button, Icon } from '@eguardimmo/ui';
import { FileDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { useDownload } from '../hooks';
import { saveBlob } from '../../rent/download';
import { ActionError } from './ActionError';

export function DownloadButton({ load, filename, children, failureTitle, variant = 'secondary', size = 'md' }: {
  load: () => Promise<Blob>;
  filename: string;
  children: ReactNode;
  failureTitle: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
}) {
  const download = useDownload();
  return (
    <>
      <Button
        variant={variant}
        size={size}
        loading={download.isPending}
        onClick={() => {
          download.mutate(load, { onSuccess: (blob) => { saveBlob(blob, filename); } });
        }}
      >
        <Icon icon={FileDown} />
        {children}
      </Button>
      {download.isError ? <ActionError title={failureTitle} error={download.error} /> : null}
    </>
  );
}
