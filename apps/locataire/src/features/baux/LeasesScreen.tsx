'use client';

import { Button, EmptyState } from '@eguardimmo/ui';
import { KeyRound } from 'lucide-react';
import Link from 'next/link';
import { FailureAlert } from '@/components/FailureAlert';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/ScreenState';
import { useLeases } from '@/tenant/queries';
import { LeaseCard } from './LeaseCard';

export function LeasesScreen() {
  const leases = useLeases();
  if (leases.data === undefined) {
    return leases.isError ? (
      <FailureAlert title="Vos baux n’ont pas pu être chargés" error={leases.error} onRetry={() => void leases.refetch()} />
    ) : (
      <Skeleton rows={2} />
    );
  }
  const items = leases.data.pages.flatMap((page) => page.items);
  return (
    <>
      <PageHeader
        title="Mes baux"
        crumbs={[{ label: 'Mon logement' }, { label: 'Mes baux' }]}
        subtitle="Les baux signés dont vous êtes locataire, toutes organisations confondues."
      />
      {items.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="Aucun bail à afficher"
          description="Seuls les baux signés ou résiliés dont vous êtes locataire apparaissent ici. Un bail terminé reste consultable pendant 12 mois."
        >
          <Button asChild variant="secondary">
            <Link href="/acces">Voir mes accès</Link>
          </Button>
        </EmptyState>
      ) : (
        <ul aria-label="Mes baux" className="flex flex-col gap-3">
          {items.map((lease) => (
            <LeaseCard key={lease.id} lease={lease} />
          ))}
        </ul>
      )}
      {leases.isFetchNextPageError ? (
        <FailureAlert title="Les baux suivants n’ont pas pu être chargés" error={leases.error} onRetry={() => void leases.fetchNextPage()} />
      ) : null}
      {leases.hasNextPage && !leases.isFetchNextPageError ? (
        <div>
          <Button variant="secondary" loading={leases.isFetchingNextPage} onClick={() => void leases.fetchNextPage()}>
            Afficher plus de baux
          </Button>
        </div>
      ) : null}
    </>
  );
}
