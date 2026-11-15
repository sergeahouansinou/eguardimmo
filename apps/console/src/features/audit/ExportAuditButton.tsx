'use client';

import { Button, Icon } from '@eguardimmo/ui';
import { Download } from 'lucide-react';
import { useExportAudit } from '@/console/hooks/mutations';
import { errorMessage } from '@/console/hooks/core';
import type { AuditQuery } from '@/console/schemas';
import { downloadTextFile } from '@/lib/download';
import { useNotify } from '@/ui/notify';

export function ExportAuditButton({ query = {} }: { query?: Omit<AuditQuery, 'page' | 'pageSize'> }) {
  const notify = useNotify();
  const exportAudit = useExportAudit();
  const run = async () => {
    try {
      const result = await exportAudit.mutateAsync(query);
      downloadTextFile(result.filename, result.csv);
      notify.success('Journal exporté', `${String(result.rows)} événements dans ${result.filename}. L’export est consigné au journal.`);
    } catch (error) {
      notify.error('Export impossible', errorMessage(error));
    }
  };
  return (
    <Button variant="secondary" loading={exportAudit.isPending} onClick={() => void run()}>
      <Icon icon={Download} />
      Exporter le journal
    </Button>
  );
}
