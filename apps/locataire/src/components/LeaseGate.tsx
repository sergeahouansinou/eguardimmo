'use client';

import { Alert, Button } from '@eguardimmo/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { FailureAlert } from '@/components/FailureAlert';
import { LeasePicker } from '@/components/LeasePicker';
import { Skeleton } from '@/components/ScreenState';
import type { LeaseSummary } from '@/tenant/model';
import type { SelectedLease } from '@/tenant/selectedLease';

export function LeaseGate({
  selection,
  errorTitle,
  children,
}: {
  selection: SelectedLease;
  errorTitle: string;
  children: (lease: LeaseSummary) => ReactNode;
}) {
  if (selection.isError) return <FailureAlert title={errorTitle} error={selection.error} onRetry={selection.refetch} />;
  if (selection.isPending) return <Skeleton rows={2} />;
  if (selection.lease === null) {
    return (
      <Alert tone="info" title="Aucun bail">
        <span className="flex flex-wrap items-center gap-2">
          Aucun bail n’est rattaché à votre compte pour le moment.
          <Button asChild variant="link" size="sm">
            <Link href="/bail">Voir mes baux</Link>
          </Button>
        </span>
      </Alert>
    );
  }
  return (
    <>
      <LeasePicker leases={selection.leases} value={selection.lease.id} onChange={selection.select} />
      {children(selection.lease)}
    </>
  );
}
