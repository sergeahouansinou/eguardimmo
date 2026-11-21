'use client';

import { Button, Card, EmptyState, Icon, StatCard } from '@eguardimmo/ui';
import { Wrench } from 'lucide-react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { FailureAlert } from '@/components/FailureAlert';
import { PageHeader } from '@/components/PageHeader';
import { Skeleton } from '@/components/ScreenState';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/dates';
import { INTERVENTION_WORDING } from '@/tenant/interventionErrors';
import { SLOT_LABEL, STATE_VIEW, isOpen, nextVisit } from '@/tenant/interventionLabels';
import { useInterventions } from '@/tenant/interventionQueries';
import { LoadMore } from '../rent/LoadMore';

export function ApiInterventionsScreen() {
  const query = useInterventions();
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const open = items.filter((item) => isOpen(item.state));
  const done = items.filter((item) => item.state === 'done');
  const upcoming = items.flatMap((item) => (isOpen(item.state) ? [{ item, visit: nextVisit(item) }] : [])).flatMap(({ item, visit }) => (visit === null ? [] : [{ item, visit }]));
  const next = [...upcoming].sort((a, b) => a.visit.scheduledOn.localeCompare(b.visit.scheduledOn))[0];

  return (
    <>
      <PageHeader
        title="Interventions"
        crumbs={[{ label: 'Échanges' }, { label: 'Interventions' }]}
        subtitle="Vos demandes de réparation et leur suivi."
        actions={
          <Button asChild>
            <Link href="/interventions/nouvelle">
              <Icon icon={Wrench} />
              Signaler un problème
            </Link>
          </Button>
        }
      />
      {query.data === undefined ? (
        query.isError ? (
          <FailureAlert title="Les interventions n’ont pas pu être chargées" error={query.error} wording={INTERVENTION_WORDING} onRetry={() => void query.refetch()} />
        ) : (
          <Skeleton rows={3} />
        )
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="En cours" value={String(open.length)}>
              <span className="truncate text-caption text-fg-subtle">{open[0]?.title ?? 'Aucune demande en cours'}</span>
            </StatCard>
            <StatCard label="Terminées" value={String(done.length)}>
              <span className="truncate text-caption text-fg-subtle">{done[0] ? done[0].title : 'Aucune demande terminée'}</span>
            </StatCard>
            <StatCard label="Prochain rendez-vous" value={next ? formatDate(next.visit.scheduledOn) : '—'}>
              <span className="text-caption text-fg-subtle">{next ? SLOT_LABEL[next.visit.slot] : 'Aucun rendez-vous prévu'}</span>
            </StatCard>
          </div>
          <Card role="region" aria-label="Liste des demandes" className="px-4 py-3">
            {items.length === 0 ? (
              <EmptyState icon={Wrench} title="Aucune demande" description="Vous n’avez encore signalé aucun problème dans votre logement." />
            ) : (
              <DataTable
                label="Demandes d’intervention"
                rows={items}
                rowKey={(item) => item.id}
                columns={[
                  {
                    id: 'demande',
                    header: 'Demande',
                    primary: true,
                    cell: (item) => (
                      <>
                        <Link href={`/interventions/${item.id}`} className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                          {item.title}
                        </Link>
                        <br />
                        <span className="text-caption font-normal text-fg-subtle">{item.reference}</span>
                      </>
                    ),
                  },
                  { id: 'lieu', header: 'Lieu', cell: (item) => item.room ?? item.place },
                  { id: 'date', header: 'Signalée le', cell: (item) => formatDate(item.reportedOn) },
                  {
                    id: 'etat',
                    header: 'État',
                    cell: (item) => <StatusBadge tone={STATE_VIEW[item.state].tone}>{STATE_VIEW[item.state].label}</StatusBadge>,
                  },
                ]}
              />
            )}
          </Card>
          <LoadMore query={query} label="Afficher plus de demandes" errorTitle="Les demandes suivantes n’ont pas pu être chargées" />
        </>
      )}
    </>
  );
}
