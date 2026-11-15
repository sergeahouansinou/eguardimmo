'use client';

import { Button, Card, Icon, StatCard } from '@eguardimmo/ui';
import { Wrench } from 'lucide-react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { Async } from '@/components/ScreenState';
import { StatusBadge } from '@/components/StatusBadge';
import { useInterventions } from '@/data/queries';
import type { Intervention } from '@/data/schemas/interventions';
import { formatDate } from '@/lib/dates';
import { interventionStatus } from '../shared/status';

export function InterventionsScreen() {
  const interventions = useInterventions();
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
      <Async query={interventions} errorTitle="Les interventions n’ont pas pu être chargées">
        {(items) => <InterventionsContent items={items} />}
      </Async>
    </>
  );
}

function InterventionsContent({ items }: { items: Intervention[] }) {
  const open = items.filter((item) => item.status !== 'terminee');
  const done = items.filter((item) => item.status === 'terminee');
  const next = items
    .filter((item): item is Intervention & { appointment: NonNullable<Intervention['appointment']> } => item.appointment !== null && item.status !== 'terminee')
    .sort((a, b) => a.appointment.date.localeCompare(b.appointment.date))[0];
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="En cours" value={String(open.length)}>
          <span className="truncate text-caption text-fg-subtle">{open[0]?.title ?? 'Aucune demande en cours'}</span>
        </StatCard>
        <StatCard label="Terminées" value={String(done.length)}>
          <span className="truncate text-caption text-fg-subtle">{done[0] ? `${done[0].title}, ${formatDate(done[0].reportedAt)}` : 'Aucune demande terminée'}</span>
        </StatCard>
        <StatCard label="Prochain rendez-vous" value={next ? formatDate(next.appointment.date) : '—'}>
          <span className="text-caption text-fg-subtle">{next ? `${next.appointment.contractor}, ${next.appointment.slot}` : 'Aucun rendez-vous prévu'}</span>
        </StatCard>
      </div>
      <Card role="region" aria-label="Liste des demandes" className="px-4 py-3">
        {items.length === 0 ? (
          <p className="py-6 text-center text-body text-fg-subtle">Vous n’avez encore signalé aucun problème.</p>
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
                    {item.title}
                    <br />
                    <span className="text-caption font-normal text-fg-subtle">
                      {item.id}
                      {item.photos.length > 0 ? ' · photos jointes' : ''}
                    </span>
                  </>
                ),
              },
              { id: 'lieu', header: 'Lieu', cell: (item) => item.room },
              { id: 'date', header: 'Signalée le', cell: (item) => formatDate(item.reportedAt) },
              {
                id: 'etat',
                header: 'État',
                cell: (item) => {
                  const view = interventionStatus(item.status);
                  return <StatusBadge tone={view.tone}>{view.label}</StatusBadge>;
                },
              },
              {
                id: 'action',
                header: 'Action',
                numeric: true,
                mobileLabel: '',
                cell: (item) => (
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/interventions/${item.id}`} aria-label={`${item.status === 'terminee' ? 'Voir' : 'Suivre'} ${item.title}`}>
                      {item.status === 'terminee' ? 'Voir' : 'Suivre'}
                    </Link>
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>
    </>
  );
}
