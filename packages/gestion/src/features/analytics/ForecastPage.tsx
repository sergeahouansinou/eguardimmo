'use client';

import { Alert, Card, StatCard, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { formatDateFr } from '../locataires/kit/dates';
import { formatMoney } from '../../format/money';
import type { Money } from '../investments/model';
import { PageHeader } from '../locataires/kit';
import { links } from '../locataires/kit/links';
import { QueryState } from '../orgapi/QueryState';
import { useOrgPermission, useOrgTimezone } from '../orgapi/hooks';
import { todayIn } from '../orgapi/zone';
import { AssumptionsForm } from './AssumptionsForm';
import { MonthlyBars } from './MonthlyBars';
import { useAnalyticsRetry, useForecast, useOccupancy } from './hooks';
import { monthLabel, monthOf, periodOf } from './period';

const money = (value: Money): string => formatMoney(value.amount, value.currency);

const warningLabel: Record<string, (count: number) => string> = {
  foreign_currency_leases_ignored: (count) => `${String(count)} ${count > 1 ? 'baux' : 'bail'} dans une autre devise ${count > 1 ? 'sont ignorés' : 'est ignoré'} de la projection.`,
};

export function ForecastPage() {
  const retry = useAnalyticsRetry();
  const forecast = useForecast();
  const timezone = useOrgTimezone();
  const permission = useOrgPermission('reporting_assumptions');
  const month = timezone.data === undefined ? null : monthOf(todayIn(timezone.data));
  const unitSource = useOccupancy(month === null ? null : periodOf(month, month));
  const units = (unitSource.data?.units ?? []).map((unit) => ({ id: unit.unitId, label: `${unit.propertyName ?? 'Bien'} · ${unit.unitReference ?? 'Lot'}` }));
  const data = forecast.data;

  return (
    <>
      <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Analytique', href: '/analytique' }, { label: 'Prévisionnel' }]} title="Prévisionnel de trésorerie" subtitle="Projection sur 12 mois à partir de vos baux, de vos dépenses habituelles et de vos prêts." />
      <QueryState query={forecast} label="Chargement du prévisionnel" title="Impossible de charger le prévisionnel" onRetry={retry} />
      {data === undefined ? null : (
        <>
          <Alert tone="info" title={data.notice}>Cette projection n’est pas un solde bancaire : elle dépend des hypothèses ci-dessous et se recalcule à chaque lecture.</Alert>
          {data.warnings.length === 0 ? null : (
            <Alert tone="warning" title="Points d’attention">
              <ul className="list-disc pl-4">
                {data.warnings.map((warning) => (
                  <li key={warning.code}>{warningLabel[warning.code]?.(warning.count) ?? warning.code}</li>
                ))}
              </ul>
            </Alert>
          )}
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
            <StatCard label={`Banque au ${formatDateFr(data.opening.asOf)}`} value={money(data.opening.amount)} />
            <StatCard label={`Position projetée fin ${monthLabel(data.months.at(-1)?.month ?? '')}`} value={data.months.length === 0 ? 'Non calculable' : money(data.months.at(-1)?.closing ?? data.opening.amount)} />
          </div>
          <Card className="gap-3">
            <MonthlyBars
              idPrefix="forecast-chart"
              title="Entrées et sorties projetées par mois"
              summary={`${String(data.months.length)} mois projetés, du ${monthLabel(data.months[0]?.month ?? '')} au ${monthLabel(data.months.at(-1)?.month ?? '')}. Les valeurs détaillées figurent dans le tableau ci-dessous.`}
              months={data.months.map((row) => row.month)}
              currency={data.currency}
              series={[
                { label: 'Entrées projetées', values: data.months.map((row) => row.inflows.total.amount), hatched: false },
                { label: 'Sorties projetées', values: data.months.map((row) => row.outflows.total.amount), hatched: true },
              ]}
            />
            <Table scrollLabel="Projection mensuelle, défilement horizontal">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Mois</TableHeaderCell>
                  <TableHeaderCell numeric>Entrées</TableHeaderCell>
                  <TableHeaderCell numeric>Dépenses courantes</TableHeaderCell>
                  <TableHeaderCell numeric>Échéances de prêts</TableHeaderCell>
                  <TableHeaderCell numeric>Dépenses ponctuelles</TableHeaderCell>
                  <TableHeaderCell numeric>Variation</TableHeaderCell>
                  <TableHeaderCell numeric>Position projetée</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.months.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell strong>{monthLabel(row.month)}</TableCell>
                    <TableCell numeric>{money(row.inflows.total)}</TableCell>
                    <TableCell numeric>{money(row.outflows.expenses)}</TableCell>
                    <TableCell numeric>{money(row.outflows.loans)}</TableCell>
                    <TableCell numeric>{money(row.outflows.oneOff)}</TableCell>
                    <TableCell numeric>{money(row.net)}</TableCell>
                    <TableCell numeric strong>{money(row.closing)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          {data.expenseCategories.length === 0 ? null : (
            <Card className="gap-2">
              <h2 className="text-block-title text-fg">Dépenses courantes retenues, par mois</h2>
              <ul className="flex flex-col gap-1 text-body text-fg-muted">
                {data.expenseCategories.map((category) => (
                  <li key={category.category} className="flex justify-between gap-3">
                    <span>{category.category}</span>
                    <b className="tabular-nums text-fg">{money(category.monthly)}</b>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {permission.write ? (
            <AssumptionsForm key={data.assumptions.lockVersion} forecast={data} units={units} />
          ) : (
            <Alert tone="info" title="Hypothèses en lecture seule">Votre rôle consulte les hypothèses sans pouvoir les modifier.</Alert>
          )}
        </>
      )}
    </>
  );
}
