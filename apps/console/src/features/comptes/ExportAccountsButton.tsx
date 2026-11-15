'use client';

import { Button, Icon } from '@eguardimmo/ui';
import { Download } from 'lucide-react';
import { useExportAccounts } from '@/console/hooks/mutations';
import { errorMessage } from '@/console/hooks/core';
import type { AccountFilters } from '@/console/schemas';
import { downloadTextFile } from '@/lib/download';
import { useNotify } from '@/ui/notify';

interface Props {
  filters: AccountFilters & { q: string; tab: 'actif' | 'invite' | 'suspendu' | '' };
}

export function ExportAccountsButton({ filters }: Props) {
  const notify = useNotify();
  const exportAccounts = useExportAccounts();
  const run = async () => {
    try {
      const result = await exportAccounts.mutateAsync(filters);
      downloadTextFile(result.filename, result.csv);
      notify.success('Comptes exportés', `${String(result.rows)} comptes dans ${result.filename}. L’export est consigné au journal.`);
    } catch (error) {
      notify.error('Export impossible', errorMessage(error));
    }
  };
  return (
    <Button variant="secondary" loading={exportAccounts.isPending} onClick={() => void run()}>
      <Icon icon={Download} />
      Exporter
    </Button>
  );
}
