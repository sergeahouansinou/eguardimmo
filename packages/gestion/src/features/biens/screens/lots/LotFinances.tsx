'use client';

import { Button, StatCard } from '@eguardimmo/ui';
import { BarChart } from '../../components/Charts';
import { DataTable } from '../../components/DataTable';
import { FactList, Panel, PillBadge, StatGrid } from '../../components/Panels';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { useBiensEnvironment } from '../../environment';
import { useListState } from '../../hooks/useListState';
import { formatDate } from '../../lib/dates';
import { externalPaths } from '../../paths';
import { useLotFinances } from '../../queries';
import { formatMoney, percent } from '../../../../format/money';

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function monthLabel(month: string): string {
  const [year = '', index = '1'] = month.split('-');
  return `${MONTHS[Number(index) - 1] ?? index} ${year.slice(2)}`;
}

export function LotFinances({ id }: { id: string }) {
  const { Link } = useBiensEnvironment();
  const query = useLotFinances(id);
  const list = useListState({ key: 'date', direction: 'desc' }, 5);
  return (
    <QueryBoundary query={query} errorTitle="Les finances du lot n’ont pas pu être chargées" skeleton={<SkeletonRows rows={6} label="Chargement des finances" />}>
      {(data) => {
        const money = (value: number, signed = false) => formatMoney(value, data.currency, { signed });
        const called = data.months.reduce((sum, month) => sum + month.called, 0);
        const collected = data.months.reduce((sum, month) => sum + month.collected, 0);
        const expenses = data.months.reduce((sum, month) => sum + month.expenses, 0);
        const net = collected - expenses;
        const yieldRate = data.purchasePrice ? Math.round((net / data.purchasePrice) * 1000) / 10 : null;
        return (
          <>
            <StatGrid>
              <StatCard label="Loyers encaissés, 12 mois" value={money(collected)}>
                <span className="text-caption text-fg-subtle">{`sur ${money(called)} appelés, hors charges`}</span>
              </StatCard>
              <StatCard label="Dépenses non récupérables" value={money(expenses)}>
                <span className="text-caption text-fg-subtle">Taxe foncière, copropriété, travaux</span>
              </StatCard>
              <StatCard label="Résultat net" value={money(net, true)}>
                <span className="text-caption text-fg-subtle">{yieldRate === null ? 'Prix d’achat non renseigné' : `Rendement net ${String(yieldRate).replace('.', ',')} %`}</span>
              </StatCard>
              <StatCard label="Reste dû par le locataire" value={money(data.balanceDue)} tone={data.balanceDue > 0 ? 'danger' : 'default'}>
                <span className="text-caption text-fg-subtle">{data.balanceNote ?? 'Aucun impayé'}</span>
              </StatCard>
            </StatGrid>
            <Panel title="Loyers et dépenses du lot">
              {data.months.length === 0 ? (
                <p className="text-body text-fg-muted">Aucun loyer appelé sur les douze derniers mois.</p>
              ) : (
                <BarChart
                  title="Loyers encaissés et dépenses par mois"
                  primaryLabel="Loyers encaissés"
                  secondaryLabel="Dépenses"
                  points={data.months.map((month) => ({
                    id: month.month,
                    label: monthLabel(month.month),
                    primary: month.collected,
                    secondary: month.expenses,
                    caption: `loyer ${money(month.collected)}, dépenses ${money(month.expenses)}${month.expenseNote ? `, ${month.expenseNote}` : ''}`,
                  }))}
                />
              )}
            </Panel>
            <Panel title="Valeur et financement">
              {data.purchasePrice === null ? (
                <p className="text-body text-fg-muted">Aucune donnée d’acquisition renseignée pour ce bien.</p>
              ) : (
                <FactList
                  rows={[
                    { label: `Prix d’achat${data.purchaseYear ? `, ${String(data.purchaseYear)}` : ''}`, value: money(data.purchasePrice) },
                    ...(data.fees === null ? [] : [{ label: 'Frais d’acquisition', value: money(data.fees) }]),
                    ...(data.estimatedValue === null ? [] : [{ label: `Valeur estimée${data.estimatedYear ? `, ${String(data.estimatedYear)}` : ''}`, value: money(data.estimatedValue) }]),
                    ...(data.estimatedValue === null ? [] : [{ label: 'Plus-value latente', value: money(data.estimatedValue - data.purchasePrice, true), badge: { label: `${String(percent(data.estimatedValue - data.purchasePrice, data.purchasePrice))} %`, tone: 'success' as const } }]),
                    ...(data.remainingCapital === null ? [] : [{ label: 'Capital restant dû', value: money(data.remainingCapital) }]),
                    ...(data.loanPayment === null ? [] : [{ label: 'Mensualité du prêt', value: data.loanPayment }]),
                  ]}
                />
              )}
            </Panel>
            <Panel
              title="Dernières opérations du lot"
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href={externalPaths.collectRent}>Encaisser un loyer</Link>
                </Button>
              }
            >
              <DataTable
                label="Dernières opérations du lot"
                rows={data.operations}
                getId={(row) => row.id}
                list={list}
                empty={<p className="text-body text-fg-muted">Aucune opération enregistrée sur ce lot.</p>}
                columns={[
                  { id: 'date', header: 'Date', sortBy: (row) => row.date, cell: (row) => formatDate(row.date) },
                  { id: 'label', header: 'Libellé', strong: true, sortBy: (row) => row.label, cell: (row) => row.label },
                  { id: 'category', header: 'Catégorie', sortBy: (row) => row.category, cell: (row) => row.category },
                  { id: 'amount', header: 'Montant', numeric: true, sortBy: (row) => row.amount, cell: (row) => (row.amount === null ? '—' : money(row.amount, true)) },
                  { id: 'status', header: 'Statut', cell: (row) => <PillBadge badge={row.status} /> },
                ]}
              />
              <Link href={externalPaths.operations} className="self-start text-caption text-action-on-subtle underline">
                Voir toutes les opérations
              </Link>
            </Panel>
          </>
        );
      }}
    </QueryBoundary>
  );
}
