'use client';

import { Badge, Checkbox, EmptyState, Select } from '@eguardimmo/ui';
import { CreditCard } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { SUBSCRIPTION_STATUSES } from '@/platform/plans/subscriptions';
import type { SubscriptionQuery, SubscriptionRow, SubscriptionStatus } from '@/platform/plans/subscriptions';
import { formatDate } from '@/lib/format';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { FilterBar } from '@/ui/FilterBar';
import { PlatformState } from '@/ui/PlatformState';
import { CursorPager } from './CursorPager';
import { useSubscriptions } from './hooks';
import { SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUS_TONES } from './labels';
import { useCursorPaging } from './useCursorPaging';

const PER_PAGE = 25;
const ALL = 'all';

const columns: Column<SubscriptionRow>[] = [
  {
    id: 'organisation',
    header: 'Organisation',
    primary: true,
    cell: (row) => (
      <Link href={`/organisations/${encodeURIComponent(row.organizationId)}`} className="inline-flex min-h-6 items-center font-mono text-caption break-all hover:underline">
        {row.organizationId}
      </Link>
    ),
  },
  { id: 'plan', header: 'Plan', cell: (row) => <span>{`${row.plan} · v${String(row.planVersion)}`}</span> },
  {
    id: 'status',
    header: 'Statut',
    cell: (row) => <Badge tone={SUBSCRIPTION_STATUS_TONES[row.status] ?? 'neutral'}>{SUBSCRIPTION_STATUS_LABELS[row.status] ?? row.status}</Badge>,
  },
  { id: 'currency', header: 'Devise', cell: (row) => row.currency ?? '—' },
  { id: 'trial', header: 'Fin d’essai', cell: (row) => (row.trialEndsAt ? formatDate(row.trialEndsAt) : '—') },
  { id: 'period', header: 'Fin de période', cell: (row) => (row.currentPeriodEnd ? formatDate(row.currentPeriodEnd) : '—') },
];

export function SubscriptionsPanel({ planCodes }: { planCodes: readonly string[] }) {
  const paging = useCursorPaging();
  const [status, setStatus] = useState<SubscriptionStatus | ''>('');
  const [plan, setPlan] = useState('');
  const [trialEnding, setTrialEnding] = useState(false);
  const query: SubscriptionQuery = {
    perPage: PER_PAGE,
    cursor: paging.cursor,
    ...(status === '' ? {} : { status }),
    ...(plan === '' ? {} : { plan }),
    ...(trialEnding ? { trialEnding: true } : {}),
  };
  const result = useSubscriptions(query);
  const filtered = (apply: () => void) => {
    apply();
    paging.reset();
  };

  return (
    <div className="flex flex-col gap-3">
      <FilterBar label="Filtrer les abonnements">
        <div className="w-full sm:w-52">
          <Select
            label="Statut"
            placeholder="Tous les statuts"
            value={status === '' ? ALL : status}
            options={[{ value: ALL, label: 'Tous les statuts' }, ...SUBSCRIPTION_STATUSES.map((value) => ({ value, label: SUBSCRIPTION_STATUS_LABELS[value] ?? value }))]}
            onValueChange={(value) => { filtered(() => { setStatus(value === ALL ? '' : (SUBSCRIPTION_STATUSES.find((candidate) => candidate === value) ?? '')); }); }}
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            label="Plan"
            placeholder="Tous les plans"
            value={plan === '' ? ALL : plan}
            options={[{ value: ALL, label: 'Tous les plans' }, ...planCodes.map((code) => ({ value: code, label: code }))]}
            onValueChange={(value) => { filtered(() => { setPlan(value === ALL ? '' : value); }); }}
          />
        </div>
        <Checkbox
          label="Essais finissant sous 3 jours"
          checked={trialEnding}
          onChange={(event) => { filtered(() => { setTrialEnding(event.target.checked); }); }}
        />
      </FilterBar>
      <PlatformState query={result} label="Les abonnements">
        {(page) =>
          page.rows.length === 0 ? (
            <EmptyState icon={CreditCard} title="Aucun abonnement" description="Aucun abonnement ne correspond à ces filtres." />
          ) : (
            <>
              <DataTable label="Abonnements" columns={columns} rows={page.rows} rowKey={(row) => row.id} Link={Link} />
              <CursorPager paging={paging} hasMore={page.hasMore} nextCursor={page.nextCursor} />
            </>
          )
        }
      </PlatformState>
    </div>
  );
}
