'use client';

import { Alert, Card, StatCard, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { formatMoney } from '../../format/money';
import { PageHeader } from '../locataires/kit';
import { links } from '../locataires/kit/links';
import { QueryState } from '../orgapi/QueryState';
import { useOrgPermission } from '../orgapi/hooks';
import { useOrgInfoSource } from '../orgapi/source';
import { AnalyticsExport } from './AnalyticsExport';
import { MonthlyBars } from './MonthlyBars';
import { PeriodForm } from './PeriodForm';
import { useAnalyticsRetry, useRevenueExpenses } from './hooks';
import type { Money } from './../investments/model';
import { monthLabel } from './period';
import { usePeriod } from './usePeriod';

const money = (value: Money): string => formatMoney(value.amount, value.currency);

export function RevenueExpensesPage() {
  const period = usePeriod();
  const retry = useAnalyticsRetry();
  const { kind } = useOrgInfoSource();
  const exportPermission = useOrgPermission('reporting_finance_export');
  const data = useRevenueExpenses(period.period);

  return (
    <>
      <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Analytique', href: '/analytique' }, { label: 'Revenus et dépenses' }]} title="Revenus et dépenses" subtitle="Encaissements, dépenses et financement par mois, d’après le grand livre." />
      {period.ready ? <PeriodForm key={`${period.initial.fromMonth}-${period.initial.toMonth}`} initial={period.initial} onApply={period.apply} /> : null}
      <QueryState query={data} label="Chargement des revenus et dépenses" title="Impossible de charger les revenus et dépenses" onRetry={retry} />
      {period.period === null || data.data === undefined ? null : (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Recettes" value={money(data.data.totals.revenue)} />
            <StatCard label="Dépenses" value={money(data.data.totals.expenses)} />
            <StatCard label="Financement" value={money(data.data.totals.financing)} />
            <StatCard label="Résultat avant financement" value={money(data.data.totals.netBeforeFinancing)} />
            <StatCard label="Résultat après financement" value={money(data.data.totals.netAfterFinancing)} />
          </div>
          {data.data.months.length === 0 ? (
            <Alert tone="info" title="Aucune donnée sur la période">Aucun mois n’est couvert par la période choisie.</Alert>
          ) : (
            <Card className="gap-3">
              <MonthlyBars
                idPrefix="revenue-chart"
                title="Recettes et dépenses par mois"
                summary={`${String(data.data.months.length)} mois, du ${monthLabel(data.data.months[0]?.month ?? '')} au ${monthLabel(data.data.months.at(-1)?.month ?? '')}. Les valeurs détaillées figurent dans le tableau ci-dessous.`}
                months={data.data.months.map((month) => month.month)}
                currency={data.data.currency}
                series={[
                  { label: 'Recettes', values: data.data.months.map((month) => month.revenue.total.amount), hatched: false },
                  { label: 'Dépenses', values: data.data.months.map((month) => month.expenses.total.amount), hatched: true },
                ]}
              />
              <Table scrollLabel="Revenus et dépenses par mois, défilement horizontal">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Mois</TableHeaderCell>
                    <TableHeaderCell numeric>Loyers</TableHeaderCell>
                    <TableHeaderCell numeric>Charges</TableHeaderCell>
                    <TableHeaderCell numeric>Honoraires</TableHeaderCell>
                    <TableHeaderCell numeric>Recettes</TableHeaderCell>
                    <TableHeaderCell numeric>Dépenses</TableHeaderCell>
                    <TableHeaderCell numeric>Financement</TableHeaderCell>
                    <TableHeaderCell numeric>Résultat après financement</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.data.months.map((month) => (
                    <TableRow key={month.month}>
                      <TableCell strong>{monthLabel(month.month)}</TableCell>
                      <TableCell numeric>{money(month.revenue.rent)}</TableCell>
                      <TableCell numeric>{money(month.revenue.charges)}</TableCell>
                      <TableCell numeric>{money(month.revenue.fees)}</TableCell>
                      <TableCell numeric strong>{money(month.revenue.total)}</TableCell>
                      <TableCell numeric>{money(month.expenses.total)}</TableCell>
                      <TableCell numeric>{money(month.financing.total)}</TableCell>
                      <TableCell numeric strong>{money(month.netAfterFinancing)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
          {data.data.units.length === 0 ? null : (
            <Card className="gap-2">
              <h2 className="text-block-title text-fg">Par lot</h2>
              <Table scrollLabel="Revenus et dépenses par lot, défilement horizontal">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Lot</TableHeaderCell>
                    <TableHeaderCell>Bien</TableHeaderCell>
                    <TableHeaderCell numeric>Recettes</TableHeaderCell>
                    <TableHeaderCell numeric>Dépenses</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.data.units.map((unit, index) => (
                    <TableRow key={unit.unitId ?? `none-${String(index)}`}>
                      <TableCell strong>{unit.unitId === null ? 'Sans lot' : (unit.unitReference ?? 'Lot')}</TableCell>
                      <TableCell>{unit.propertyName ?? 'Non rattaché'}</TableCell>
                      <TableCell numeric>{money(unit.revenue)}</TableCell>
                      <TableCell numeric>{money(unit.expenses)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
          {kind === 'individual' && exportPermission.read ? (
            <AnalyticsExport label="Exporter les prêts (CSV)" filename={`prets-immobiliers-${period.period.from}-${period.period.to}.csv`} request={{ type: 'prets-immobiliers', from: period.period.from, to: period.period.to }} />
          ) : null}
        </>
      )}
    </>
  );
}
