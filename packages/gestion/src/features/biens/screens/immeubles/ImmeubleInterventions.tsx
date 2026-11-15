'use client';

import { Badge, Button, StatCard } from '@eguardimmo/ui';
import { DataTable } from '../../components/DataTable';
import { EntryList, Panel, StatGrid } from '../../components/Panels';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { useBiensEnvironment } from '../../environment';
import { useListState } from '../../hooks/useListState';
import { formatDate } from '../../lib/dates';
import { plural } from '../../lib/text';
import { externalPaths } from '../../paths';
import { useImmeubleInterventions } from '../../queries';
import { formatMoney } from '../../../../format/money';

const COMMON_PLACE = 'Parties communes';

export function ImmeubleInterventions({ id }: { id: string }) {
  const { Link } = useBiensEnvironment();
  const query = useImmeubleInterventions(id);
  const list = useListState({ key: 'date', direction: 'desc' }, 6);
  return (
    <QueryBoundary query={query} errorTitle="Les interventions n’ont pas pu être chargées" skeleton={<SkeletonRows rows={6} label="Chargement des interventions" />}>
      {(data) => {
        const ongoing = data.items.filter((item) => item.status.label === 'En cours');
        const common = data.items.filter((item) => item.place === COMMON_PLACE).length;
        const ownerCost = data.items.filter((item) => item.paidBy === 'Bailleur').reduce((sum, item) => sum + (item.cost ?? 0), 0);
        const quote = ongoing.find((item) => item.cost === null && item.costNote !== null)?.costNote;
        return (
          <>
            <StatGrid>
              <StatCard label="En cours" value={ongoing.length}>
                <span className="text-caption text-fg-subtle">{ongoing.length > 0 ? ongoing.map((item) => `${item.title}, ${item.place}`).join(' ; ') : 'Aucune intervention en cours'}</span>
              </StatCard>
              <StatCard label={`Interventions en ${String(data.year)}`} value={data.items.length}>
                <span className="text-caption text-fg-subtle">{`${plural(data.items.length - common, 'dans vos lots', 'dans vos lots')}, ${plural(common, 'en parties communes', 'en parties communes')}`}</span>
              </StatCard>
              <StatCard label={`À votre charge en ${String(data.year)}`} value={formatMoney(ownerCost, data.currency)}>
                <span className="text-caption text-fg-subtle">{quote ? `Hors ${quote.toLowerCase()}` : 'Coûts constatés'}</span>
              </StatCard>
              <StatCard label="Délai moyen de clôture" value={data.averageCloseDays === null ? '—' : plural(data.averageCloseDays, 'jour')}>
                <span className="text-caption text-fg-subtle">De la demande à la fin</span>
              </StatCard>
            </StatGrid>
            <Panel
              title="Interventions dans l’immeuble"
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href={externalPaths.newIntervention}>Créer une intervention</Link>
                </Button>
              }
            >
              <DataTable
                label="Interventions de l’immeuble"
                rows={data.items}
                getId={(row) => row.id}
                list={list}
                pageSizes={[6, 10, 25]}
                empty={<p className="text-body text-fg-muted">Aucune intervention enregistrée pour cet immeuble.</p>}
                columns={[
                  { id: 'date', header: 'Date', sortBy: (row) => row.date, cell: (row) => formatDate(row.date) },
                  { id: 'title', header: 'Intervention', strong: true, sortBy: (row) => row.title, cell: (row) => row.title },
                  { id: 'place', header: 'Lieu', sortBy: (row) => row.place, cell: (row) => row.place },
                  { id: 'provider', header: 'Prestataire', sortBy: (row) => row.provider, cell: (row) => row.provider },
                  { id: 'paidBy', header: 'Payé par', sortBy: (row) => row.paidBy, cell: (row) => row.paidBy },
                  { id: 'cost', header: 'Coût', numeric: true, sortBy: (row) => row.cost, cell: (row) => (row.cost === null ? (row.costNote ?? '—') : formatMoney(row.cost, data.currency)) },
                  { id: 'status', header: 'Statut', cell: (row) => <Badge tone={row.status.tone}>{row.status.label}</Badge> },
                ]}
              />
            </Panel>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Sinistres et assurance">
                <EntryList label="Sinistres et assurance" empty="Aucun sinistre déclaré." items={data.claims.map((claim) => ({ id: claim.id, title: claim.title, detail: claim.detail, badge: claim.pill }))} />
              </Panel>
              <Panel
                title="Prestataires de l’immeuble"
                action={
                  <Button variant="link" size="sm" asChild>
                    <Link href={externalPaths.contacts}>Carnet de contacts</Link>
                  </Button>
                }
              >
                <EntryList label="Prestataires" empty="Aucun prestataire enregistré." items={data.providers.map((provider) => ({ id: provider.id, title: provider.name, detail: provider.detail, badge: { label: provider.trade, tone: 'neutral' } }))} />
              </Panel>
            </div>
          </>
        );
      }}
    </QueryBoundary>
  );
}
