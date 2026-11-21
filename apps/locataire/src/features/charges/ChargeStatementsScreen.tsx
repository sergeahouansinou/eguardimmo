'use client';

import { Button, Card, EmptyState } from '@eguardimmo/ui';
import { PiggyBank } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { FailureAlert } from '@/components/FailureAlert';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/ScreenState';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/dates';
import { BALANCE_SHORT_LABEL, CHARGE_STATUS_VIEW, CHARGE_WORDING, balanceDirection, exerciseLabel } from '@/tenant/chargeLabels';
import { useChargeStatements } from '@/tenant/chargeQueries';
import { formatApiMoney } from '@/tenant/format';
import { isUuid } from '@/tenant/ids';
import { useLeases } from '@/tenant/queries';
import { leaseName } from '@/tenant/rentLabels';
import { LeaseFilter } from '../rent/LeaseFilter';
import { LoadMore } from '../rent/LoadMore';

export function ChargeStatementsScreen() {
  const requested = useSearchParams().get('bail');
  const [leaseId, setLeaseId] = useState<string | null>(isUuid(requested) ? requested : null);
  const statements = useChargeStatements(leaseId);
  const leases = (useLeases().data?.pages ?? []).flatMap((page) => page.items);
  const items = statements.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageHeader
        title="Régularisation des charges"
        crumbs={[{ label: 'Mon logement' }, { label: 'Régularisation des charges' }]}
        subtitle="Les décomptes de charges émis pour vos baux : votre part des charges réelles comparée aux provisions appelées."
        actions={
          <Button variant="secondary" asChild>
            <Link href="/loyers">Mes loyers</Link>
          </Button>
        }
      />
      {leases.length > 1 || leaseId !== null ? (
        <Card role="region" aria-label="Filtres des décomptes" className="flex-row flex-wrap gap-3 px-4 py-3">
          <LeaseFilter value={leaseId} onChange={setLeaseId} />
        </Card>
      ) : null}
      {statements.data === undefined ? (
        statements.isError ? (
          <FailureAlert title="Vos décomptes de charges n’ont pas pu être chargés" error={statements.error} onRetry={() => void statements.refetch()} wording={CHARGE_WORDING} />
        ) : (
          <Skeleton rows={3} />
        )
      ) : items.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Aucun décompte de charges pour l’instant"
          description={
            leaseId === null
              ? 'Un décompte est émis une fois les charges réelles de l’année arrêtées.'
              : 'Aucun décompte n’a été émis pour ce bail.'
          }
        />
      ) : (
        <DataTable
          label="Mes décomptes de charges"
          rows={items}
          rowKey={(item) => item.id}
          columns={[
            {
              id: 'numero',
              header: 'Décompte',
              primary: true,
              cell: (item) => (
                <div className="min-w-0">
                  <Link href={`/loyers/regularisation/${item.id}`} className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                    {item.number}
                  </Link>
                  <br />
                  <span className="text-caption font-normal text-fg-subtle">
                    {exerciseLabel(item.periodStart, item.periodEnd) ?? 'Période non précisée'}
                  </span>
                </div>
              ),
            },
            { id: 'bail', header: 'Bail', cell: (item) => leaseName({ reference: leases.find((lease) => lease.id === item.leaseId)?.reference ?? null }) },
            { id: 'emis', header: 'Émis le', cell: (item) => (item.issuedAt === null ? '—' : formatDate(item.issuedAt)) },
            {
              id: 'solde',
              header: 'Solde',
              numeric: true,
              cell: (item) => {
                const direction = balanceDirection(item.balance);
                return direction === 'none'
                  ? BALANCE_SHORT_LABEL.none
                  : `${BALANCE_SHORT_LABEL[direction]} ${formatApiMoney({ amount: Math.abs(item.balance.amount), currency: item.balance.currency })}`;
              },
            },
            {
              id: 'etat',
              header: 'État',
              cell: (item) => <StatusBadge tone={CHARGE_STATUS_VIEW[item.status].tone}>{CHARGE_STATUS_VIEW[item.status].label}</StatusBadge>,
            },
          ]}
        />
      )}
      <LoadMore query={statements} label="Voir plus de décomptes" errorTitle="Les décomptes suivants n’ont pas pu être chargés" />
    </>
  );
}
