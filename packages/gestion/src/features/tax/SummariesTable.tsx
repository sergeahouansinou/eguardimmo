'use client';

import { Badge, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { formatMoney } from '../../format/money';
import { useGestionNavigation } from '../locataires/kit';
import { useOrgTimezone } from '../orgapi/hooks';
import { formatDateTimeFr } from '../orgapi/zone';
import { summaryStatusLabel, summaryStatusTone } from './labels';
import type { TaxSummary } from './model';
import { taxPaths } from './paths';

export function SummariesTable({ items, mandantNames }: { items: readonly TaxSummary[]; mandantNames: ReadonlyMap<string, string> | null }) {
  const { Link } = useGestionNavigation();
  const timezone = useOrgTimezone();
  const zone = timezone.data ?? 'UTC';
  return (
    <Table scrollLabel="Synthèses fiscales, défilement horizontal">
      <TableHead>
        <TableRow>
          {mandantNames === null ? null : <TableHeaderCell>Mandant</TableHeaderCell>}
          <TableHeaderCell>Année</TableHeaderCell>
          <TableHeaderCell>État</TableHeaderCell>
          <TableHeaderCell numeric>Ligne 263, revenu foncier</TableHeaderCell>
          <TableHeaderCell>Créée le</TableHeaderCell>
          <TableHeaderCell>Publiée le</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((summary) => {
          const net = summary.totals.find((total) => total.code === '263');
          return (
            <TableRow key={summary.id}>
              {mandantNames === null ? null : <TableCell strong>{(summary.mandantPartyId === null ? null : mandantNames.get(summary.mandantPartyId)) ?? 'Mandant'}</TableCell>}
              <TableCell>
                <Link href={taxPaths.summary(summary.id)} className="text-action-on-subtle underline underline-offset-2">{`Revenus ${String(summary.incomeYear)}`}</Link>
              </TableCell>
              <TableCell>
                <Badge tone={summaryStatusTone[summary.status]}>{summaryStatusLabel[summary.status]}</Badge>
              </TableCell>
              <TableCell numeric>{net === undefined ? 'Non renseignée' : formatMoney(net.amount.amount, net.amount.currency)}</TableCell>
              <TableCell>{summary.createdAt === null ? 'Inconnue' : formatDateTimeFr(summary.createdAt, zone)}</TableCell>
              <TableCell>{summary.publishedAt === null ? 'Non publiée' : formatDateTimeFr(summary.publishedAt, zone)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
