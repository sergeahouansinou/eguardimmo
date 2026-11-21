'use client';

import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { moneyText } from './labels';
import type { StatementLine } from './model';
import { useRubricLabels } from './parts/choices';

export function StatementLines({ lines }: { lines: readonly StatementLine[] }) {
  const rubrics = useRubricLabels();
  if (lines.length === 0) return <p className="text-body text-fg-subtle">Aucune ligne.</p>;
  return (
    <Table aria-label="Lignes du décompte">
      <TableHead>
        <TableRow>
          <TableHeaderCell>Poste</TableHeaderCell>
          <TableHeaderCell>Rubrique</TableHeaderCell>
          <TableHeaderCell>Répartition</TableHeaderCell>
          <TableHeaderCell numeric>Montant du poste</TableHeaderCell>
          <TableHeaderCell numeric>Jours</TableHeaderCell>
          <TableHeaderCell numeric>Quote-part</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {lines.map((line) => (
          <TableRow key={line.itemId}>
            <TableCell strong>{line.label}</TableCell>
            <TableCell>{rubrics.labelOf(line.rubric)}</TableCell>
            <TableCell>{line.splitLabel}</TableCell>
            <TableCell numeric>{moneyText(line.itemAmount)}</TableCell>
            <TableCell numeric>{line.days}</TableCell>
            <TableCell numeric>{moneyText(line.share)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
