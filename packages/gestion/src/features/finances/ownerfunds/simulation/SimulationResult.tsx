'use client';

import { Alert, Badge, Button, Card, CardTitle, EmptyState, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { CalendarX } from 'lucide-react';
import { formatMoney } from '../../../../format/money';
import { moneyText } from '../labels';
import type { Money } from '../model';
import { ownerFundsPaths } from '../paths';
import type { AmountSource, FeeSimulation, SimulationMonth } from './model';
import { ListLoading, errorMessage, useGestionNavigation } from '../../../locataires/kit';
import { monthLabel } from '../../../locataires/kit/dates';

const SOURCE_LABEL: Record<AmountSource, string> = { statement: 'Relevé posé', computed: 'Calculé au barème en vigueur', simulation: 'Simulation' };

const signed = (value: Money): string => formatMoney(value.amount, value.currency, { signed: true });
const optional = (value: Money | null, format: (money: Money) => string = moneyText): string => (value === null ? '—' : format(value));

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-line py-1.5 first:border-t-0">
      <dt className="text-body text-fg-muted">{label}</dt>
      <dd className={strong ? 'text-body font-medium text-fg [overflow-wrap:anywhere]' : 'text-body text-fg [overflow-wrap:anywhere]'}>{value}</dd>
    </div>
  );
}

function Totals({ simulation }: { simulation: FeeSimulation }) {
  const totals = simulation.totals;
  if (totals === null) return null;
  return (
    <Card role="region" aria-label="Totaux de la simulation">
      <CardTitle as="h2">Totaux sur {simulation.monthsReturned} mois</CardTitle>
      <dl>
        <Line label="Honoraires simulés HT" value={moneyText(totals.simulatedNet)} />
        <Line label="Honoraires simulés TTC" value={moneyText(totals.simulatedTotal)} strong />
        <Line label="Honoraires actuels HT" value={optional(totals.currentNet)} />
        <Line label="Honoraires actuels TTC" value={optional(totals.currentTotal)} />
        <Line label="Écart HT" value={optional(totals.differenceNet, signed)} />
        <Line label="Écart TTC" value={optional(totals.differenceTotal, signed)} strong />
      </dl>
      {totals.currentTotal === null ? (
        <p className="text-caption text-fg-subtle">Les honoraires actuels ne sont pas calculables sur tous les mois : le barème en vigueur du mandat n’indique pas de base. Passez un avenant pour la renseigner.</p>
      ) : null}
    </Card>
  );
}

function MonthRow({ line }: { line: SimulationMonth }) {
  return (
    <TableRow>
      <TableCell strong>{monthLabel(line.month)}</TableCell>
      <TableCell numeric>{moneyText(line.baseRent)}</TableCell>
      <TableCell numeric>{moneyText(line.baseCharges)}</TableCell>
      <TableCell numeric>
        {line.current === null ? (
          <span title="Barème en vigueur sans base d’honoraires">Non calculable</span>
        ) : (
          <span title={SOURCE_LABEL[line.current.source]}>{moneyText(line.current.feeTotal)}</span>
        )}
      </TableCell>
      <TableCell numeric>{moneyText(line.simulated.feeNet)}</TableCell>
      <TableCell numeric>{moneyText(line.simulated.taxAmount)}</TableCell>
      <TableCell numeric className="font-medium text-fg">
        <span className="inline-flex items-center justify-end gap-1">
          {line.simulated.minimumApplied ? <Badge tone="info">Minimum appliqué</Badge> : null}
          {moneyText(line.simulated.feeTotal)}
        </span>
      </TableCell>
      <TableCell numeric>{line.difference === null ? '—' : signed(line.difference.feeTotal)}</TableCell>
    </TableRow>
  );
}

export function SimulationResult({ pending, error, simulation, onRetry }: { pending: boolean; error: unknown; simulation: FeeSimulation | null; onRetry: () => void }) {
  const { Link } = useGestionNavigation();
  return (
    <div aria-live="polite" className="flex min-w-0 flex-col gap-3">
      {pending ? <ListLoading label="Calcul de la simulation" /> : null}
      {!pending && error !== null ? (
        <Alert tone="danger" title="La simulation n’a pas pu être calculée">
          <span className="[overflow-wrap:anywhere]">{errorMessage(error)}</span>{' '}
          <Button variant="secondary" size="sm" onClick={onRetry}>Réessayer</Button>
        </Alert>
      ) : null}
      {!pending && error === null && simulation?.noClosedPeriod ? (
        <Card role="region" aria-label="Résultat de la simulation">
          <EmptyState icon={CalendarX} title="Aucun mois clos à simuler" description="La simulation s’appuie sur les derniers mois clos. Clôturez un mois pour obtenir un résultat.">
            <Button variant="secondary" asChild>
              <Link href={ownerFundsPaths.closing}>Ouvrir la clôture mensuelle</Link>
            </Button>
          </EmptyState>
        </Card>
      ) : null}
      {!pending && error === null && simulation !== null && !simulation.noClosedPeriod ? (
        <>
          <Card role="region" aria-label="Résultat de la simulation">
            <CardTitle as="h2">Mois par mois</CardTitle>
            <Table aria-label="Simulation des honoraires mois par mois">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Mois</TableHeaderCell>
                  <TableHeaderCell numeric>Loyers</TableHeaderCell>
                  <TableHeaderCell numeric>Charges</TableHeaderCell>
                  <TableHeaderCell numeric>Actuel TTC</TableHeaderCell>
                  <TableHeaderCell numeric>Simulé HT</TableHeaderCell>
                  <TableHeaderCell numeric>TVA</TableHeaderCell>
                  <TableHeaderCell numeric>Simulé TTC</TableHeaderCell>
                  <TableHeaderCell numeric>Écart TTC</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {simulation.months.map((line) => (
                  <MonthRow key={line.month} line={line} />
                ))}
              </TableBody>
            </Table>
            {simulation.monthsReturned < simulation.monthsRequested ? (
              <p className="text-caption text-fg-subtle">{`Seuls ${String(simulation.monthsReturned)} mois clos sont disponibles sur les ${String(simulation.monthsRequested)} demandés.`}</p>
            ) : null}
          </Card>
          <Totals simulation={simulation} />
        </>
      ) : null}
    </div>
  );
}
