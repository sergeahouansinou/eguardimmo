'use client';

import { useNotify, errorMessage } from '../../locataires/kit';
import { useMaintenanceMutation } from '../hooks';
import type { MaintenanceSource } from '../source';

export function useRowAction(): (title: string, action: (source: MaintenanceSource) => Promise<unknown>) => void {
  const notify = useNotify();
  const run = useMaintenanceMutation((source, action: (source: MaintenanceSource) => Promise<unknown>) => action(source));
  return (title, action) => {
    run.mutateAsync(action).then(
      () => { notify({ title }); },
      (error: unknown) => { notify({ tone: 'danger', title: 'Action non enregistrée', description: errorMessage(error) }); },
    );
  };
}
