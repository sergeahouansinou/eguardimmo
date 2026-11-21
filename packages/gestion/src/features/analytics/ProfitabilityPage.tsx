'use client';

import { Alert, Card, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { useState } from 'react';
import { formatMoney } from '../../format/money';
import { LinkButton, PageHeader, useGestionNavigation } from '../locataires/kit';
import { links } from '../locataires/kit/links';
import { investmentsPaths } from '../investments/paths';
import type { Money } from '../investments/model';
import { QueryState } from '../orgapi/QueryState';
import { useOrgPermission, useOrgTimezone } from '../orgapi/hooks';
import { todayIn } from '../orgapi/zone';
import { AnalyticsExport } from './AnalyticsExport';
import { useAnalyticsRetry, useProfitability } from './hooks';
import type { ProfitabilityReason } from './model';
import { percentOfBp } from './period';

const money = (value: Money): string => formatMoney(value.amount, value.currency);
const FIRST_YEAR = 2000;

const reasonLabel: Record<ProfitabilityReason, string> = {
  cost_missing: 'Non calculable : coût de revient manquant',
  not_yet_acquired: 'Non calculable : bien pas encore acquis',
};

const assumptionLabel: Record<string, string> = {
  before_tax: 'Rentabilité avant impôt.',
  rent: 'Loyers encaissés, hors charges refacturées.',
  expenses: 'Dépenses payées et non récupérées, hors intérêts d’emprunt.',
  financing: 'Financement : intérêts, assurance et frais d’emprunt.',
  rounding: 'Pourcentages arrondis au centième de point.',
  annualized: 'Chiffres non annualisés.',
  cost_basis: 'Coût de revient : prix d’achat, frais d’acquisition, frais d’agence et travaux initiaux.',
};

const warningLabel: Record<string, string> = {
  unallocated_amounts: 'Des montants d’un bien suivi lot par lot ne sont rattachés à aucun lot : ils ne sont répartis nulle part.',
  unattributed_expenses: 'Des dépenses ne sont rattachées à aucun bien : elles ne figurent dans aucune rentabilité.',
};

export function ProfitabilityPage() {
  const timezone = useOrgTimezone();
  const retry = useAnalyticsRetry();
  const exportPermission = useOrgPermission('reporting_finance_export');
  const currentYear = timezone.data === undefined ? null : Number(todayIn(timezone.data).slice(0, 4));
  const [chosen, setChosen] = useState<number | null>(null);
  const year = chosen ?? currentYear;
  const data = useProfitability(year ?? 0, year !== null);
  const { Link } = useGestionNavigation();
  const years = currentYear === null ? [] : Array.from({ length: currentYear - FIRST_YEAR + 1 }, (_, index) => currentYear - index);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Analytique', href: '/analytique' }, { label: 'Rentabilité' }]}
        title="Rentabilité par bien"
        subtitle="Rendements bruts et nets calculés par le serveur à partir du coût de revient."
        actions={<LinkButton href={investmentsPaths.acquisitions}>Coût de revient des biens</LinkButton>}
      />
      {year === null ? null : (
        <Select label="Année" placeholder="Choisissez une année" value={String(year)} onValueChange={(value) => { setChosen(Number(value)); }} options={years.map((value) => ({ value: String(value), label: String(value) }))} />
      )}
      <QueryState query={data} label="Chargement de la rentabilité" title="Impossible de charger la rentabilité" onRetry={retry} />
      {data.data === undefined ? null : (
        <>
          {data.data.partial ? (
            <Alert tone="info" title="Année en cours">Les chiffres couvrent la période écoulée seulement : ils ne sont pas annualisés.</Alert>
          ) : null}
          {data.data.warnings.length === 0 ? null : (
            <Alert tone="warning" title="Points d’attention">
              <ul className="list-disc pl-4">
                {data.data.warnings.map((warning, index) => (
                  <li key={index}>{`${warningLabel[warning.code] ?? warning.code} (${money(warning.amount)})`}</li>
                ))}
              </ul>
            </Alert>
          )}
          {data.data.rows.length === 0 ? (
            <Alert tone="info" title="Aucun bien">Aucun bien n’a de coût de revient ni d’activité sur cette année.</Alert>
          ) : (
            <Card className="gap-2">
              <Table scrollLabel="Rentabilité par bien, défilement horizontal">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Bien</TableHeaderCell>
                    <TableHeaderCell numeric>Coût de revient</TableHeaderCell>
                    <TableHeaderCell numeric>Loyers encaissés</TableHeaderCell>
                    <TableHeaderCell numeric>Dépenses non récupérées</TableHeaderCell>
                    <TableHeaderCell numeric>Financement</TableHeaderCell>
                    <TableHeaderCell numeric>Rendement brut</TableHeaderCell>
                    <TableHeaderCell numeric>Rendement net</TableHeaderCell>
                    <TableHeaderCell numeric>Net après financement</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.data.rows.map((row) => (
                    <TableRow key={`${row.propertyId}-${row.unitId ?? ''}`}>
                      <TableCell strong>{row.unitReference === null ? (row.propertyName ?? 'Bien') : `${row.propertyName ?? 'Bien'} · ${row.unitReference}`}</TableCell>
                      <TableCell numeric>{row.cost === null ? 'Non renseigné' : money(row.cost)}</TableCell>
                      <TableCell numeric>{money(row.rentCollected)}</TableCell>
                      <TableCell numeric>{money(row.expensesUnrecovered)}</TableCell>
                      <TableCell numeric>{money(row.financing.total)}</TableCell>
                      {row.reason === null ? (
                        <>
                          <TableCell numeric>{row.grossBp === null ? 'Non calculable' : percentOfBp(row.grossBp)}</TableCell>
                          <TableCell numeric>{row.netBp === null ? 'Non calculable' : percentOfBp(row.netBp)}</TableCell>
                          <TableCell numeric>{row.netAfterFinancingBp === null ? 'Non calculable' : percentOfBp(row.netAfterFinancingBp)}</TableCell>
                        </>
                      ) : (
                        <TableCell colSpan={3}>
                          {reasonLabel[row.reason]}
                          {row.reason === 'cost_missing' ? (
                            <>
                              {' '}
                              <Link href={investmentsPaths.acquisitions} className="text-action-on-subtle underline underline-offset-2">Renseigner le coût</Link>
                            </>
                          ) : null}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
          <Card className="gap-1">
            <h2 className="text-block-title text-fg">Hypothèses de calcul</h2>
            <ul className="list-disc pl-4 text-body text-fg-muted">
              {Object.entries(data.data.assumptions).map(([key, value]) => (
                <li key={key}>{assumptionLabel[key] ?? `${key} : ${String(value)}`}</li>
              ))}
            </ul>
          </Card>
          {exportPermission.read ? <AnalyticsExport label="Exporter la rentabilité (CSV)" filename={`rentabilite-par-bien-${String(data.data.year)}.csv`} request={{ type: 'rentabilite-par-bien', year: data.data.year }} /> : null}
        </>
      )}
    </>
  );
}
