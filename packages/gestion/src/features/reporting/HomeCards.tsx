'use client';

import { Alert, StatCard, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { CircleAlert, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAging } from './hooks';
import { agingLabel, moneyText, plural, rateText } from './labels';
import type { Aging, RentCard } from './model';
import { CardState } from './parts';
import { ListLoading, LoadError } from '../locataires/kit';
import { monthLabel } from '../locataires/kit/dates';

export function StatSlot({ label, query, failure, children }: { label: string; query: { isPending: boolean; isError: boolean; error: Error | null }; failure: string; children: ReactNode }) {
  if (query.isError) {
    return (
      <section aria-label={label} className="min-w-0">
        <Alert tone="danger" title={failure}>{query.error?.message ?? 'Vérifiez votre connexion puis rechargez la page.'}</Alert>
      </section>
    );
  }
  if (query.isPending) {
    return (
      <section aria-label={label} className="min-w-0 rounded-lg border border-line bg-surface px-4 py-3">
        <ListLoading label={`Chargement : ${label}`} />
      </section>
    );
  }
  return children;
}

export function RentCollectedStat({ card }: { card: RentCard }) {
  return (
    <StatCard label={`Loyers encaissés, ${monthLabel(card.month)}`} icon={Wallet} value={moneyText(card.rentCollected)}>
      <span className="text-caption text-fg-subtle">{`sur ${moneyText(card.rentCalled)} appelés · ${rateText(card.collectionRateBp)}`}</span>
    </StatCard>
  );
}

export function ArrearsStat() {
  const aging = useAging();
  return (
    <StatSlot label="Impayés" query={aging} failure="Les impayés n’ont pas pu être chargés">
      {aging.data ? (
        <StatCard label="Impayés" icon={CircleAlert} tone={aging.data.total.amount > 0 ? 'danger' : 'default'} value={moneyText(aging.data.total)}>
          <span className="text-caption text-fg-subtle">{plural(aging.data.count, 'créance ouverte', 'créances ouvertes')}</span>
        </StatCard>
      ) : null}
    </StatSlot>
  );
}

export function AgingTable({ aging }: { aging: Aging }) {
  return (
    <Table aria-label="Impayés par ancienneté">
      <TableHead>
        <TableRow>
          <TableHeaderCell>Ancienneté</TableHeaderCell>
          <TableHeaderCell numeric>Créances</TableHeaderCell>
          <TableHeaderCell numeric>Reste dû</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {aging.buckets.map((bucket) => (
          <TableRow key={bucket.bucket}>
            <TableCell strong>{agingLabel[bucket.bucket]}</TableCell>
            <TableCell numeric>{bucket.count}</TableCell>
            <TableCell numeric>{moneyText(bucket.amount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function AgingPanel() {
  const aging = useAging();
  return (
    <CardState query={aging} loading="Chargement des impayés" failure="Les impayés n’ont pas pu être chargés">
      {aging.data ? <AgingTable aging={aging.data} /> : <LoadError title="Les impayés n’ont pas pu être chargés" />}
    </CardState>
  );
}
