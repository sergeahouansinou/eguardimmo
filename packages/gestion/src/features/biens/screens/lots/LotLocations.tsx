'use client';

import { Badge, Button, Chip, StatCard } from '@eguardimmo/ui';
import { useState } from 'react';
import { BarChart } from '../../components/Charts';
import { DataTable } from '../../components/DataTable';
import { EntryList, Panel, StatGrid } from '../../components/Panels';
import { QueryBoundary, SkeletonRows } from '../../components/QueryState';
import { useBiensEnvironment } from '../../environment';
import { useListState } from '../../hooks/useListState';
import { formatDate, formatDuration } from '../../lib/dates';
import { occupationStats } from '../../lib/occupationStats';
import { periodDetail, periodRange, periodStatus } from '../../lib/summaries';
import { externalPaths } from '../../paths';
import { useLotOccupation } from '../../queries';
import type { Period } from '../../schemas/lots';
import { formatMoney } from '../../../../format/money';

type Filter = 'tout' | 'bail' | 'vacance';

export function LotLocations({ id }: { id: string }) {
  const { Link } = useBiensEnvironment();
  const query = useLotOccupation(id);
  const [filter, setFilter] = useState<Filter>('tout');
  const list = useListState({ key: 'period', direction: 'desc' }, 6);
  return (
    <QueryBoundary query={query} errorTitle="L’historique des locations n’a pas pu être chargé" skeleton={<SkeletonRows rows={6} label="Chargement des locations" />}>
      {(data) => {
        const stats = occupationStats(data);
        const rows = data.periods.filter((period) => filter === 'tout' || period.kind === filter);
        const money = (value: number | null) => (value === null ? '—' : formatMoney(value, data.currency));
        const counts = { tout: data.periods.length, bail: stats.leases, vacance: data.periods.length - stats.leases };
        return (
          <>
            <StatGrid>
              <StatCard label="Locataires depuis l’achat" value={stats.tenants}>
                <span className="text-caption text-fg-subtle">{`Achat le ${formatDate(data.acquisitionDate)}`}</span>
              </StatCard>
              <StatCard label="Durée moyenne d’un bail" value={stats.averageLease ?? '—'}>
                <span className="text-caption text-fg-subtle">Baux terminés</span>
              </StatCard>
              <StatCard label="Vacance cumulée" value={stats.vacancy}>
                <span className="text-caption text-fg-subtle">{`${String(stats.rate)} % du temps loué`}</span>
              </StatCard>
              <StatCard label="Loyer hors charges" value={data.rentSteps.at(-1) ? money(data.rentSteps.at(-1)?.rent ?? 0) : '—'}>
                <span className="text-caption text-fg-subtle">
                  {stats.rentChange ? `${stats.rentChange.percent > 0 ? '+' : ''}${String(stats.rentChange.percent).replace('.', ',')} % depuis ${String(stats.rentChange.since)}` : 'Aucune révision'}
                </span>
              </StatCard>
            </StatGrid>
            <Panel
              title="Baux et périodes de vacance"
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href={externalPaths.newLease}>Nouveau bail</Link>
                </Button>
              }
            >
              <div role="group" aria-label="Filtrer les périodes" className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['tout', 'Tout'],
                    ['bail', 'Baux'],
                    ['vacance', 'Vacances'],
                  ] as const
                ).map(([value, label]) => (
                  <Chip key={value} pressed={filter === value} onClick={() => { setFilter(value); list.restart(); }}>
                    {`${label} ${String(counts[value])}`}
                  </Chip>
                ))}
              </div>
              <DataTable
                label="Baux et périodes de vacance"
                rows={rows}
                getId={(row) => row.id}
                list={list}
                empty={<p className="text-body text-fg-muted">Aucune période à afficher pour ce filtre.</p>}
                columns={[
                  { id: 'period', header: 'Période', sortBy: (row) => row.startDate, cell: (row) => periodRange(row) },
                  {
                    id: 'occupant',
                    header: 'Occupant',
                    strong: true,
                    cell: (row: Period) =>
                      row.kind === 'vacance' ? (
                        <span className="font-normal text-fg-subtle">{periodDetail(row, data.asOf)}</span>
                      ) : row.occupant ? (
                        <Link href={externalPaths.tenant(row.occupant.id)} className="hover:underline">
                          {row.occupant.name}
                        </Link>
                      ) : (
                        '—'
                      ),
                  },
                  { id: 'lease', header: 'Bail', cell: (row) => (row.kind === 'bail' ? (row.leaseType ?? '—') : '') },
                  { id: 'duration', header: 'Durée', cell: (row) => (row.kind === 'bail' ? formatDuration(row.startDate, row.endDate ?? data.asOf) : '') },
                  { id: 'entry', header: 'Loyer d’entrée', numeric: true, cell: (row) => (row.kind === 'bail' ? money(row.entryRent) : '') },
                  { id: 'last', header: 'Dernier loyer', numeric: true, cell: (row) => (row.kind === 'bail' ? money(row.lastRent) : '') },
                  { id: 'deposit', header: 'Dépôt', numeric: true, cell: (row) => (row.kind === 'bail' ? money(row.deposit) : '') },
                  { id: 'exit', header: 'Sortie', cell: (row) => (row.kind === 'bail' ? (row.exitNote ?? '—') : '') },
                  {
                    id: 'status',
                    header: 'Statut',
                    cell: (row) => {
                      const status = periodStatus(row);
                      return status ? <Badge tone={status.tone}>{status.label}</Badge> : null;
                    },
                  },
                ]}
              />
            </Panel>
            {data.rentSteps.length > 0 ? (
              <Panel title="Loyer hors charges au 1er janvier">
                <BarChart
                  title="Loyer hors charges par année"
                  primaryLabel="Loyer hors charges"
                  points={data.rentSteps.map((step) => ({ id: String(step.year), label: String(step.year), primary: step.rent, caption: `${money(step.rent)}${step.event ? `, ${step.event}` : ''}` }))}
                />
                <p className="text-caption text-fg-subtle">
                  {`Révisions IRL et relocations : ${data.rentSteps.filter((step) => step.event).map((step) => `${String(step.year)} ${step.event?.toLowerCase() ?? ''}`).join(', ') || 'aucune'}.`}
                </p>
              </Panel>
            ) : null}
            <Panel
              title="États des lieux"
              action={
                <Button variant="link" asChild>
                  <Link href={externalPaths.edls}>{`Tout voir, ${String(data.inspections.length)}`}</Link>
                </Button>
              }
            >
              <EntryList
                label="États des lieux du bien"
                empty="Aucun état des lieux enregistré."
                items={data.inspections.map((item) => ({
                  id: item.id,
                  title: item.title,
                  detail: `${formatDate(item.date)} · ${item.detail}`,
                  badge: item.signed ? { label: 'Signé', tone: 'success' } : { label: 'À signer', tone: 'warning' },
                }))}
              />
            </Panel>
          </>
        );
      }}
    </QueryBoundary>
  );
}
