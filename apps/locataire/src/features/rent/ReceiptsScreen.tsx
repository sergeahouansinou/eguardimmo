'use client';

import { Button, Card, EmptyState } from '@eguardimmo/ui';
import { FileText } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { FailureAlert } from '@/components/FailureAlert';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/ScreenState';
import { formatDate } from '@/lib/dates';
import { formatApiMoney } from '@/tenant/format';
import { isUuid } from '@/tenant/ids';
import { leaseName, periodTitle } from '@/tenant/rentLabels';
import { usePdfDownload, useReceipts } from '@/tenant/rentQueries';
import { LeaseFilter } from './LeaseFilter';
import { LoadMore } from './LoadMore';
import { DownloadFailure, PdfIconButton, receiptRequest } from './PdfButton';
import { ReceiptStatus } from './ReceiptStatus';

export function ReceiptsScreen() {
  const requested = useSearchParams().get('bail');
  const [leaseId, setLeaseId] = useState<string | null>(isUuid(requested) ? requested : null);
  const receipts = useReceipts(leaseId);
  const downloads = usePdfDownload();
  const items = receipts.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageHeader
        title="Mes quittances"
        crumbs={[{ label: 'Mon logement' }, { label: 'Mes quittances' }]}
        subtitle="Les quittances émises pour vos loyers soldés. Une quittance annulée reste listée mais ne se télécharge plus."
        actions={
          <Button variant="secondary" asChild>
            <Link href="/loyers">Mes loyers</Link>
          </Button>
        }
      />
      <Card role="region" aria-label="Filtres des quittances" className="flex-row flex-wrap gap-3 px-4 py-3">
        <LeaseFilter value={leaseId} onChange={setLeaseId} />
      </Card>
      <DownloadFailure downloads={downloads} />
      {receipts.data === undefined ? (
        receipts.isError ? (
          <FailureAlert title="Vos quittances n’ont pas pu être chargées" error={receipts.error} onRetry={() => void receipts.refetch()} />
        ) : (
          <Skeleton rows={3} />
        )
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucune quittance pour le moment"
          description={
            leaseId === null
              ? 'Une quittance est émise quand un loyer est soldé.'
              : 'Aucune quittance n’a été émise pour ce bail.'
          }
        />
      ) : (
        <DataTable
          label="Mes quittances"
          rows={items}
          rowKey={(item) => item.id}
          columns={[
            {
              id: 'numero',
              header: 'Quittance',
              primary: true,
              cell: (item) => (
                <div className="min-w-0">
                  <Link href={`/loyers/quittances/${item.id}`} className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                    {item.number}
                  </Link>
                  <br />
                  <span className="text-caption font-normal text-fg-subtle">{item.periodStart === null ? 'Période non précisée' : periodTitle(item.periodStart)}</span>
                </div>
              ),
            },
            { id: 'bail', header: 'Bail', cell: (item) => leaseName(item.lease) },
            { id: 'emise', header: 'Émise le', cell: (item) => formatDate(item.issuedOn) },
            { id: 'total', header: 'Montant', numeric: true, cell: (item) => formatApiMoney(item.amounts.total) },
            { id: 'statut', header: 'Statut', cell: (item) => <ReceiptStatus isVoid={item.isVoid} /> },
            {
              id: 'actions',
              header: 'Document',
              numeric: true,
              mobileLabel: '',
              cell: (item) =>
                item.isVoid ? null : <PdfIconButton label={`Télécharger la quittance ${item.number}`} downloads={downloads} request={receiptRequest(item)} />,
            },
          ]}
        />
      )}
      <LoadMore query={receipts} label="Afficher plus de quittances" errorTitle="Les quittances suivantes n’ont pas pu être chargées" />
    </>
  );
}
