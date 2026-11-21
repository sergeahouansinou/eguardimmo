'use client';

import { Badge, Card, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { DescriptionList, LedgerLines, NoRows, useGestionNavigation } from '../locataires/kit';
import { formatDateFr } from '../locataires/kit/dates';
import { dayTime, lineKindLabel, moneyText, periodKindLabel, periodText, plural, rateText, sectionLabel } from './labels';
import type { Money, Report } from './model';
import { reportingPaths } from './paths';

const money = (value: Money | null): string => (value === null ? '—' : moneyText(value));

export function ReportInfoCard({ report, name }: { report: Report; name: string }) {
  const { Link } = useGestionNavigation();
  const read = report.status === 'published' || report.status === 'superseded' ? (report.firstReadAt === null ? 'Pas encore lu par le mandant' : `Lu le ${dayTime(report.firstReadAt)}`) : '—';
  const items = [
    { term: 'Mandant', detail: <Link href={reportingPaths.statement(report.mandantId)} className="text-action-on-subtle underline-offset-2 hover:underline">{name}</Link> },
    { term: 'Période', detail: `${periodText(report.period)} · ${periodKindLabel[report.period.kind]}` },
    { term: 'Numéro', detail: report.number ?? 'Attribué à la publication' },
    { term: 'Généré le', detail: report.generatedAt === null ? 'Pas encore généré' : dayTime(report.generatedAt) },
    { term: 'Publié le', detail: report.publishedAt === null ? '—' : dayTime(report.publishedAt) },
    { term: 'Publication planifiée', detail: report.scheduledFor === null ? '—' : dayTime(report.scheduledFor) },
    { term: 'Lecture', detail: read },
    { term: 'Lots', detail: report.units.length === 0 ? '—' : plural(report.units.length, 'lot', 'lots') },
    { term: 'Mandats', detail: report.mandates.length === 0 ? '—' : report.mandates.map((mandate) => `${mandate.reference}${mandate.feeBasisPoints === null ? '' : ` (${rateText(mandate.feeBasisPoints)})`}`).join(', ') },
    ...(report.supersedesId === null
      ? []
      : [{ term: 'Rectifie', detail: <Link href={reportingPaths.report(report.supersedesId)} className="text-action-on-subtle underline-offset-2 hover:underline">Le compte rendu remplacé</Link> }]),
    ...(report.rectificationReason === null ? [] : [{ term: 'Motif', detail: report.rectificationReason }]),
  ];
  return (
    <Card role="region" aria-label="Informations du compte rendu" className="gap-3">
      <h2 className="text-block-title text-fg">Informations</h2>
      <DescriptionList items={items} termWidth="140px" />
    </Card>
  );
}

export function ReportTotalsCard({ report }: { report: Report }) {
  const { totals } = report;
  const empty = report.status === 'draft';
  return (
    <Card role="region" aria-label="Chiffres du compte rendu" className="gap-3">
      <h2 className="text-block-title text-fg">Chiffres</h2>
      {empty ? (
        <NoRows>Aucun chiffre : générez le compte rendu pour les faire calculer par le serveur.</NoRows>
      ) : (
        <LedgerLines
          lines={[
            { label: 'Solde d’ouverture', value: money(totals.openingBalance) },
            { label: 'Loyers et charges encaissés', value: money(totals.collected) },
            { label: 'Honoraires', value: money(totals.fees) },
            { label: 'Travaux imputés', value: money(totals.works) },
            { label: 'Reversements', value: money(totals.payout) },
            ...(totals.adjustments === null ? [] : [{ label: 'Régularisations', value: money(totals.adjustments) }]),
          ]}
          total={{ label: 'Solde de clôture', value: money(totals.closingBalance) }}
        />
      )}
    </Card>
  );
}

export function ReportLinesCard({ report }: { report: Report }) {
  const lines = report.lines ?? [];
  if (report.status === 'draft' || report.lines === null) return null;
  const units = new Map(report.units.map((unit) => [unit.id, unit.reference]));
  return (
    <Card role="region" aria-label="Lignes du compte rendu" className="gap-3">
      <h2 className="text-block-title text-fg">Lignes</h2>
      {lines.length === 0 ? (
        <NoRows>Aucune ligne sur cette période.</NoRows>
      ) : (
        <Table aria-label="Lignes du compte rendu">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Lot</TableHeaderCell>
              <TableHeaderCell>Libellé</TableHeaderCell>
              <TableHeaderCell numeric>Montant</TableHeaderCell>
              <TableHeaderCell>Sens</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.position}>
                <TableCell>{formatDateFr(line.date)}</TableCell>
                <TableCell>{lineKindLabel[line.kind]}</TableCell>
                <TableCell>{line.unitId === null ? '—' : (units.get(line.unitId) ?? '—')}</TableCell>
                <TableCell>{line.label}</TableCell>
                <TableCell numeric>{moneyText(line.amount)}</TableCell>
                <TableCell><Badge tone={line.direction === 'credit' ? 'success' : 'neutral'}>{line.direction === 'credit' ? 'Crédit mandant' : 'Débit mandant'}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="text-caption text-fg-subtle">{`Sections incluses : ${report.sections.map((section) => sectionLabel[section]).join(', ')}.`}</p>
    </Card>
  );
}
