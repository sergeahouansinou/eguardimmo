'use client';

import { Badge, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { formatMoney } from '../../format/money';
import { CopyAmount } from './CopyAmount';
import { lineStatusLabel, lineStatusTone, sourceLabel } from './labels';
import type { TaxLine } from './model';

export function IncomeLines({ lines, label }: { lines: readonly TaxLine[]; label: string }) {
  return (
    <Table scrollLabel={`${label}, défilement horizontal`}>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Ligne</TableHeaderCell>
          <TableHeaderCell>Libellé</TableHeaderCell>
          <TableHeaderCell>État</TableHeaderCell>
          <TableHeaderCell numeric>Montant à reporter</TableHeaderCell>
          <TableHeaderCell>Copie</TableHeaderCell>
          <TableHeaderCell>Origine</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {lines.map((line) => (
          <TableRow key={line.code}>
            <TableCell strong>{line.code}</TableCell>
            <TableCell>{line.label}</TableCell>
            <TableCell>
              <Badge tone={lineStatusTone[line.status]}>{lineStatusLabel[line.status]}</Badge>
            </TableCell>
            <TableCell numeric strong>{formatMoney(line.rounded.amount, line.rounded.currency)}</TableCell>
            <TableCell>
              <CopyAmount value={line.rounded} label={`ligne ${line.code}`} />
            </TableCell>
            <TableCell>
              {line.sources.length === 0 ? (
                'Aucune'
              ) : (
                <details>
                  <summary className="cursor-pointer text-action-on-subtle">{`${String(line.sources.length)} élément${line.sources.length > 1 ? 's' : ''}`}</summary>
                  <ul className="mt-1 flex flex-col gap-0.5 text-caption">
                    {line.sources.map((source, index) => (
                      <li key={index}>{`${sourceLabel(source.kind)} : ${formatMoney(source.amount.amount, source.amount.currency)}`}</li>
                    ))}
                    {line.sourcesTruncated ? <li>La liste des éléments est tronquée : le total reste exact.</li> : null}
                  </ul>
                </details>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
