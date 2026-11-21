'use client';

import { Alert, Card, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { PageHeader } from '../locataires/kit';
import { links } from '../locataires/kit/links';
import { QueryState } from '../orgapi/QueryState';
import { PeriodForm } from './PeriodForm';
import { useAnalyticsRetry, useOccupancy } from './hooks';
import type { OccupancyState } from './model';
import { monthLabel, percentOfBp } from './period';
import { usePeriod } from './usePeriod';

const stateLabel: Record<OccupancyState, string> = { occupied: 'Occupé', notice: 'Préavis donné', vacant: 'Vacant' };
const stateGlyph: Record<OccupancyState, string> = { occupied: '●', notice: '◐', vacant: '○' };
const stateClass: Record<OccupancyState, string> = { occupied: 'bg-action-subtle text-action-on-subtle', notice: 'border border-warning-line bg-surface text-warning-fg', vacant: 'bg-muted text-fg-muted' };

export function OccupancyPage() {
  const period = usePeriod();
  const retry = useAnalyticsRetry();
  const data = useOccupancy(period.period);

  return (
    <>
      <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Analytique', href: '/analytique' }, { label: 'Occupation' }]} title="Occupation des lots" subtitle="État de chaque lot, mois par mois, d’après les baux." />
      {period.ready ? <PeriodForm key={`${period.initial.fromMonth}-${period.initial.toMonth}`} initial={period.initial} onApply={period.apply} /> : null}
      <QueryState query={data} label="Chargement de l’occupation" title="Impossible de charger l’occupation" onRetry={retry} />
      {data.data === undefined ? null : data.data.units.length === 0 ? (
        <Alert tone="info" title="Aucun lot">Aucun lot actif n’est enregistré : l’occupation s’affichera dès qu’un lot sera créé.</Alert>
      ) : (
        <>
          <Card className="gap-2">
            <h2 className="text-block-title text-fg">Taux d’occupation</h2>
            <Table scrollLabel="Taux d’occupation par mois, défilement horizontal">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Mois</TableHeaderCell>
                  <TableHeaderCell numeric>Lots occupés</TableHeaderCell>
                  <TableHeaderCell numeric>Préavis donné</TableHeaderCell>
                  <TableHeaderCell numeric>Lots vacants</TableHeaderCell>
                  <TableHeaderCell numeric>Taux d’occupation</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.data.summary.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell strong>{monthLabel(row.month)}</TableCell>
                    <TableCell numeric>{row.occupied}</TableCell>
                    <TableCell numeric>{row.notice}</TableCell>
                    <TableCell numeric>{row.vacant}</TableCell>
                    <TableCell numeric strong>{row.occupancyRateBp === null ? 'Non calculable' : percentOfBp(row.occupancyRateBp)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Card className="gap-2">
            <h2 className="text-block-title text-fg">État par lot</h2>
            <ul className="flex flex-wrap gap-3 text-caption text-fg-muted" aria-label="Légende">
              {(Object.keys(stateLabel) as OccupancyState[]).map((state) => (
                <li key={state} className="inline-flex items-center gap-1">
                  <span aria-hidden="true" className={`inline-flex size-5 items-center justify-center rounded-sm ${stateClass[state]}`}>{stateGlyph[state]}</span>
                  {stateLabel[state]}
                </li>
              ))}
            </ul>
            <Table scrollLabel="État de chaque lot par mois, défilement horizontal">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Lot</TableHeaderCell>
                  {data.data.months.map((month) => (
                    <TableHeaderCell key={month}>{monthLabel(month, 'short')}</TableHeaderCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.data.units.map((unit) => (
                  <TableRow key={unit.unitId}>
                    <TableCell strong>{`${unit.propertyName ?? 'Bien'} · ${unit.unitReference ?? 'Lot'}`}</TableCell>
                    {unit.months.map((cell) => (
                      <TableCell key={cell.month}>
                        <span className={`inline-flex size-6 items-center justify-center rounded-sm ${stateClass[cell.state]}`}>
                          <span aria-hidden="true">{stateGlyph[cell.state]}</span>
                          <span className="sr-only">{`${stateLabel[cell.state]}, ${String(cell.occupiedDays)} jours sur ${String(cell.days)}`}</span>
                        </span>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </>
  );
}
