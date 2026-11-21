'use client';

import { Button, Card, EmptyState } from '@eguardimmo/ui';
import { Wallet } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { FailureAlert } from '@/components/FailureAlert';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/ScreenState';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/dates';
import { formatApiMoney } from '@/tenant/format';
import { isUuid } from '@/tenant/ids';
import { PAYMENT_STATUS_VIEW, leaseName, paymentMethodName } from '@/tenant/rentLabels';
import { usePayments } from '@/tenant/rentQueries';
import { LeaseFilter } from './LeaseFilter';
import { LoadMore } from './LoadMore';

export function PaymentsScreen() {
  const requested = useSearchParams().get('bail');
  const [leaseId, setLeaseId] = useState<string | null>(isUuid(requested) ? requested : null);
  const payments = usePayments(leaseId);
  const items = payments.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageHeader
        title="Mes paiements"
        crumbs={[{ label: 'Mon logement' }, { label: 'Mes paiements' }]}
        subtitle="Les paiements enregistrés par votre agence ou votre bailleur sur vos baux, y compris ceux de vos colocataires."
        actions={
          <Button variant="secondary" asChild>
            <Link href="/loyers">Mes loyers</Link>
          </Button>
        }
      />
      <Card role="region" aria-label="Filtres des paiements" className="flex-row flex-wrap gap-3 px-4 py-3">
        <LeaseFilter value={leaseId} onChange={setLeaseId} />
      </Card>
      {payments.data === undefined ? (
        payments.isError ? (
          <FailureAlert title="Vos paiements n’ont pas pu être chargés" error={payments.error} onRetry={() => void payments.refetch()} />
        ) : (
          <Skeleton rows={3} />
        )
      ) : items.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Aucun paiement pour le moment"
          description={leaseId === null ? 'Un paiement apparaît ici dès qu’il est enregistré sur votre bail.' : 'Aucun paiement n’a été enregistré sur ce bail.'}
        />
      ) : (
        <DataTable
          label="Mes paiements"
          rows={items}
          rowKey={(item) => item.id}
          columns={[
            {
              id: 'date',
              header: 'Reçu le',
              primary: true,
              cell: (item) => (
                <Link href={`/loyers/paiements/${item.id}`} className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                  {formatDate(item.receivedOn)}
                </Link>
              ),
            },
            { id: 'montant', header: 'Montant', numeric: true, cell: (item) => formatApiMoney(item.amount) },
            { id: 'mode', header: 'Mode', cell: (item) => paymentMethodName(item.method) },
            { id: 'bail', header: 'Bail', cell: (item) => leaseName(item.lease) },
            {
              id: 'statut',
              header: 'Statut',
              cell: (item) => <StatusBadge tone={PAYMENT_STATUS_VIEW[item.status].tone}>{PAYMENT_STATUS_VIEW[item.status].label}</StatusBadge>,
            },
          ]}
        />
      )}
      <LoadMore query={payments} label="Afficher plus de paiements" errorTitle="Les paiements suivants n’ont pas pu être chargés" />
    </>
  );
}
