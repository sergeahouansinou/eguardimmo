'use client';

import { Button, Card, EmptyState, Select } from '@eguardimmo/ui';
import { ReceiptText } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { FailureAlert } from '@/components/FailureAlert';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/ScreenState';
import { formatDate } from '@/lib/dates';
import { NOT_AVAILABLE, formatApiMoney } from '@/tenant/format';
import { isUuid } from '@/tenant/ids';
import type { InstallmentStatus } from '@/tenant/rentModel';
import { INSTALLMENT_STATUS_VIEW, leaseName, periodTitle } from '@/tenant/rentLabels';
import { useInstallments, usePdfDownload } from '@/tenant/rentQueries';
import { ALL, LeaseFilter } from './LeaseFilter';
import { LoadMore } from './LoadMore';
import { DownloadFailure, PdfIconButton, noticeRequest } from './PdfButton';
import { StatusCell } from './StatusCell';

const STATUS_OPTIONS = [
  { value: ALL, label: 'Tous les statuts' },
  ...(Object.keys(INSTALLMENT_STATUS_VIEW) as InstallmentStatus[]).map((status) => ({ value: status, label: INSTALLMENT_STATUS_VIEW[status].label })),
];

const isStatus = (value: string): value is InstallmentStatus => value in INSTALLMENT_STATUS_VIEW;

export function InstallmentsScreen() {
  const requested = useSearchParams().get('bail');
  const [leaseId, setLeaseId] = useState<string | null>(isUuid(requested) ? requested : null);
  const [status, setStatus] = useState<InstallmentStatus | null>(null);
  const installments = useInstallments({ leaseId, status });
  const downloads = usePdfDownload();
  const items = installments.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = leaseId !== null || status !== null;

  return (
    <>
      <PageHeader
        title="Mes loyers"
        crumbs={[{ label: 'Mon logement' }, { label: 'Mes loyers' }]}
        subtitle="Les avis d’échéance appelés pour vos baux, ce qu’il reste à payer et la quittance quand le loyer est soldé."
        actions={
          <>
            <Button asChild>
              <Link href={leaseId === null ? '/loyers/payer' : `/loyers/payer?bail=${leaseId}`}>Payer mon loyer</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/loyers/quittances">Mes quittances</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/loyers/paiements">Mes paiements</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/loyers/regularisation">Régularisation des charges</Link>
            </Button>
          </>
        }
      />
      <Card role="region" aria-label="Filtres des échéances" className="flex-row flex-wrap gap-3 px-4 py-3">
        <Select
          label="Statut"
          placeholder="Tous les statuts"
          className="w-full sm:w-56"
          value={status ?? ALL}
          options={STATUS_OPTIONS}
          onValueChange={(next) => { setStatus(isStatus(next) ? next : null); }}
        />
        <LeaseFilter value={leaseId} onChange={setLeaseId} />
      </Card>
      <DownloadFailure downloads={downloads} />
      {installments.data === undefined ? (
        installments.isError ? (
          <FailureAlert title="Vos loyers n’ont pas pu être chargés" error={installments.error} onRetry={() => void installments.refetch()} />
        ) : (
          <Skeleton rows={3} />
        )
      ) : items.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={filtered ? 'Aucune échéance ne correspond à ces filtres' : 'Aucun avis pour le moment'}
          description={
            filtered
              ? 'Essayez un autre statut ou un autre bail.'
              : 'Les avis d’échéance apparaissent ici dès que votre agence ou votre bailleur appelle le loyer.'
          }
        />
      ) : (
        <DataTable
          label="Mes échéances de loyer"
          rows={items}
          rowKey={(item) => item.id}
          columns={[
            {
              id: 'periode',
              header: 'Échéance',
              primary: true,
              cell: (item) => (
                <div className="min-w-0">
                  <Link href={`/loyers/echeances/${item.id}`} className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                    {periodTitle(item.periodStart)}
                  </Link>
                  <br />
                  <span className="text-caption font-normal text-fg-subtle">À payer avant le {formatDate(item.dueOn)}</span>
                </div>
              ),
            },
            { id: 'bail', header: 'Bail', cell: (item) => leaseName(item.lease) },
            { id: 'total', header: 'Montant', numeric: true, cell: (item) => formatApiMoney(item.amounts.total) },
            { id: 'reste', header: 'Reste dû', numeric: true, cell: (item) => (item.outstanding === null ? NOT_AVAILABLE : formatApiMoney(item.outstanding)) },
            { id: 'statut', header: 'Statut', cell: (item) => <StatusCell item={item} /> },
            {
              id: 'actions',
              header: 'Documents',
              numeric: true,
              mobileLabel: '',
              cell: (item) => (
                <span className="inline-flex items-center gap-1.5">
                  {item.notice === null ? null : (
                    <PdfIconButton
                      label={`Télécharger l’avis d’échéance ${periodTitle(item.periodStart)}`}
                      downloads={downloads}
                      request={noticeRequest({ id: item.id, notice: item.notice })}
                    />
                  )}
                  {item.receipt === null ? null : (
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/loyers/quittances/${item.receipt.id}`} aria-label={`Voir la quittance ${item.receipt.number}`}>
                        Quittance
                      </Link>
                    </Button>
                  )}
                </span>
              ),
            },
          ]}
        />
      )}
      <LoadMore query={installments} label="Afficher plus d’échéances" errorTitle="Les échéances suivantes n’ont pas pu être chargées" />
    </>
  );
}
