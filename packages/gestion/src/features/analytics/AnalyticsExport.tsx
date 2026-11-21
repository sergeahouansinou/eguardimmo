'use client';

import { Button, Icon } from '@eguardimmo/ui';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { saveBlob } from '../finances/rent/download';
import { ActionError } from '../orgapi/ActionError';
import { useExportCsv } from './hooks';
import type { ExportRequest } from './model';

export function AnalyticsExport({ label, filename, request }: { label: string; filename: string; request: ExportRequest }) {
  const exporter = useExportCsv();
  const [failure, setFailure] = useState<unknown>(null);
  const run = async () => {
    setFailure(null);
    try {
      saveBlob(await exporter.mutateAsync(request), filename);
    } catch (error) {
      setFailure(error);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button variant="secondary" loading={exporter.isPending} onClick={() => { void run(); }}>
          <Icon icon={Download} />
          {label}
        </Button>
      </div>
      {failure === null ? null : <ActionError title="Export impossible" error={failure} />}
    </div>
  );
}
