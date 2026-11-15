'use client';

import { Badge, Button } from '@eguardimmo/ui';
import { useState } from 'react';
import { CategoryImportDialog } from '../../components/CategoryImportDialog';
import { DataTable } from '../../components/DataTable';
import { EntryList, FactList, Panel } from '../../components/Panels';
import { NotFoundPanel } from '../../components/NotFoundPanel';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { useBiensEnvironment } from '../../environment';
import { useListState } from '../../hooks/useListState';
import { formatDate } from '../../lib/dates';
import { biensPaths, externalPaths } from '../../paths';
import { useImmeubleCopro } from '../../queries';
import { formatMoney } from '../../../../format/money';

export function ImmeubleCopro({ id }: { id: string }) {
  const { Link } = useBiensEnvironment();
  const query = useImmeubleCopro(id);
  const [importing, setImporting] = useState(false);
  const meetings = useListState({ key: 'date', direction: 'desc' }, 4);
  const plan = useListState({ key: 'year', direction: 'asc' });
  return (
    <QueryBoundary query={query} errorTitle="La copropriété n’a pas pu être chargée" skeleton={<SkeletonRows rows={6} label="Chargement de la copropriété" />}>
      {(data) => {
        if (data === null) {
          return <NotFoundPanel title="Cet immeuble n’est pas en copropriété" backHref={biensPaths.immeuble(id)} backLabel="Retour à la vue d’ensemble" />;
        }
        const currency = data.currency;
        return (
          <>
            <Panel
              title="Assemblées générales"
              action={
                <Button variant="secondary" size="sm" onClick={() => { setImporting(true); }}>
                  Ajouter un procès-verbal
                </Button>
              }
            >
              <p className="text-caption text-fg-subtle">Convocation au moins 21 jours avant</p>
              <DataTable
                label="Assemblées générales"
                rows={data.meetings}
                getId={(row) => row.id}
                list={meetings}
                pageSizes={[4, 10]}
                empty={<p className="text-body text-fg-muted">Aucune assemblée enregistrée.</p>}
                columns={[
                  { id: 'date', header: 'Date', strong: true, sortBy: (row) => row.date, cell: (row) => formatDate(row.date) },
                  { id: 'type', header: 'Type', sortBy: (row) => row.type, cell: (row) => row.type },
                  { id: 'decisions', header: 'Décisions principales', cell: (row) => row.decisions },
                  { id: 'vote', header: 'Votre vote', sortBy: (row) => row.vote, cell: (row) => row.vote ?? '—' },
                  {
                    id: 'status',
                    header: 'Statut',
                    sortBy: (row) => Number(row.held),
                    cell: (row) => <Badge tone={row.held ? 'neutral' : 'info'}>{row.held ? 'Tenue' : 'À venir'}</Badge>,
                  },
                ]}
              />
            </Panel>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel
                title="Syndic et conseil syndical"
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={externalPaths.newMessage}>Contacter</Link>
                  </Button>
                }
              >
                <FactList rows={data.syndic} single />
              </Panel>
              <Panel title={`Appels de fonds ${String(data.year)}`}>
                <EntryList
                  label="Appels de fonds"
                  empty="Aucun appel de fonds."
                  items={data.calls.map((call) => ({
                    id: call.id,
                    title: call.label,
                    detail: `${formatMoney(call.amount, currency)}, ${call.paid ? 'payé' : 'à payer'}`,
                    badge: { label: call.paid ? 'Payé' : 'À payer', tone: call.paid ? 'success' : 'warning' },
                  }))}
                />
                <p className="flex items-baseline justify-between border-t border-line pt-2 text-body font-medium text-fg">
                  <span>Votre solde au fonds de travaux</span>
                  <span className="tabular-nums">{formatMoney(data.fundBalance, currency)}</span>
                </p>
              </Panel>
            </div>
            <Panel title="Plan pluriannuel de travaux, votre part">
              <p className="text-caption text-fg-subtle">{`Adopté le ${formatDate(data.plan.adoptedOn)}, sur ${String(data.plan.years)} ans`}</p>
              <DataTable
                label="Plan pluriannuel de travaux"
                rows={data.plan.items}
                getId={(row) => row.id}
                list={plan}
                footer={false}
                empty={<p className="text-body text-fg-muted">Aucun travaux au plan.</p>}
                columns={[
                  { id: 'label', header: 'Travaux', strong: true, sortBy: (row) => row.label, cell: (row) => row.label },
                  { id: 'year', header: 'Année', numeric: true, sortBy: (row) => row.year, cell: (row) => row.year },
                  { id: 'share', header: 'Votre part', numeric: true, sortBy: (row) => row.share, cell: (row) => formatMoney(row.share, currency) },
                  { id: 'financing', header: 'Financement', sortBy: (row) => row.financing, cell: (row) => row.financing },
                  { id: 'status', header: 'Statut', cell: (row) => <Badge tone={row.status.tone}>{row.status.label}</Badge> },
                ]}
              />
            </Panel>
            <Panel title="Obligations de la copropriété">
              <EntryList label="Obligations de la copropriété" items={data.obligations.map((item) => ({ id: item.id, title: item.label, detail: item.detail, badge: item.pill }))} />
            </Panel>
            <CategoryImportDialog owner={{ kind: 'immeuble', id }} category="Assemblée" title="Ajouter un procès-verbal" pickerLabel="Déposer le procès-verbal ici" open={importing} onOpenChange={setImporting} />
          </>
        );
      }}
    </QueryBoundary>
  );
}
