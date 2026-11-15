'use client';

import { Alert, Button, Card } from '@eguardimmo/ui';
import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { Async2 } from '@/components/ScreenState';
import { StatusBadge } from '@/components/StatusBadge';
import { useInspections, useLease } from '@/data/queries';
import type { Inspection } from '@/data/schemas/logement';
import { formatDate } from '@/lib/dates';
import { downloadDemoPdf } from '@/lib/demoPdf';

const STATUS: Record<Inspection['status'], { label: string; tone: 'success' | 'warning' | 'info' }> = {
  signe: { label: 'Signé', tone: 'success' },
  a_planifier: { label: 'À planifier', tone: 'warning' },
  propose: { label: 'Proposé', tone: 'info' },
};

export function EtatsScreen() {
  const inspections = useInspections();
  const lease = useLease();
  return (
    <Async2 a={inspections} b={lease} errorTitle="Les états des lieux n’ont pas pu être chargés">
      {(items, leaseData) => {
        const exit = items.find((item) => item.kind === 'sortie');
        return (
          <>
            <PageHeader
              title="États des lieux"
              crumbs={[{ label: 'Mon logement' }, { label: 'États des lieux' }]}
              subtitle="L'état des lieux d'entrée sert de référence pour la restitution du dépôt de garantie."
            />
            {exit?.status === 'a_planifier' ? (
              <Alert tone="info" title="État des lieux de sortie à planifier">
                Il sera fixé avec {leaseData.landlord.name} dès que vous aurez donné congé.
              </Alert>
            ) : null}
            {exit?.status === 'propose' ? (
              <Alert tone="info" title="État des lieux de sortie proposé">
                {leaseData.landlord.name} vous proposera une date avant votre départ
                {leaseData.notice ? ` du ${formatDate(leaseData.notice.departureOn)}` : ''}.
              </Alert>
            ) : null}
            <Card role="region" aria-label="Liste des états des lieux" className="px-4 py-3">
              <DataTable
                label="États des lieux"
                rows={items}
                rowKey={(item) => item.id}
                columns={[
                  {
                    id: 'type',
                    header: 'Type',
                    primary: true,
                    cell: (item) => (
                      <>
                        {item.kind === 'entree' ? 'Entrée' : 'Sortie'}
                        <br />
                        <span className="text-caption font-normal text-fg-subtle">{item.caption}</span>
                      </>
                    ),
                  },
                  { id: 'date', header: 'Date', cell: (item) => (item.date ? formatDate(item.date) : '—') },
                  {
                    id: 'etat',
                    header: 'État',
                    cell: (item) => (
                      <StatusBadge tone={STATUS[item.status].tone} icon={item.status === 'signe' ? CircleCheck : undefined}>
                        {STATUS[item.status].label}
                      </StatusBadge>
                    ),
                  },
                  { id: 'photos', header: 'Photos', numeric: true, cell: (item) => (item.photosCount > 0 ? String(item.photosCount) : '—') },
                  {
                    id: 'actions',
                    header: 'Actions',
                    numeric: true,
                    mobileLabel: '',
                    cell: (item) =>
                      item.status === 'signe' ? (
                        <span className="inline-flex flex-wrap justify-end gap-1">
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/etats-des-lieux/${item.id}`}>Voir le détail</Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { downloadDemoPdf(`etat-des-lieux-${item.id}.pdf`, `État des lieux d'entrée`, [item.address]); }}
                          >
                            Télécharger
                          </Button>
                        </span>
                      ) : leaseData.status === 'en_cours' ? (
                        <Button size="sm" variant="secondary" asChild>
                          <Link href="/bail/conge">Donner congé</Link>
                        </Button>
                      ) : null,
                  },
                ]}
              />
            </Card>
          </>
        );
      }}
    </Async2>
  );
}
