'use client';

import { Alert, Badge, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { moneyText, rejectedLabel, sourceLabel } from './labels';
import type { RejectedLine, StatementPreview } from './model';
import { formatDateFr } from '../../locataires/kit/dates';

export function RejectedList({ rejected, total }: { rejected: readonly RejectedLine[]; total: number }) {
  if (total === 0) return null;
  return (
    <Alert tone="warning" title={`${String(total)} ligne${total > 1 ? 's' : ''} refusée${total > 1 ? 's' : ''} par le serveur`}>
      <ul className="mt-1 list-disc pl-5">
        {rejected.map((item) => (
          <li key={`${String(item.line)}-${item.code}`}>{`Ligne ${String(item.line)} : ${rejectedLabel(item.code)}`}</li>
        ))}
      </ul>
      {rejected.length < total ? <p className="mt-1">{`Seules les ${String(rejected.length)} premières sont détaillées.`}</p> : null}
    </Alert>
  );
}

export function ImportPreview({ preview }: { preview: StatementPreview }) {
  return (
    <div className="flex flex-col gap-3" role="region" aria-label="Aperçu du relevé">
      {preview.alreadyImported ? <Alert tone="warning" title="Relevé déjà importé">Ce relevé existe déjà pour ce compte : l’importer ne créera aucune ligne en double.</Alert> : null}
      {preview.isCopy ? <Alert tone="info" title="Copie du relevé">Le fichier est signalé comme une copie : les lignes déjà présentes seront ignorées.</Alert> : null}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-body sm:grid-cols-4">
        <Fact label="Format"><Badge tone="info">{sourceLabel[preview.source]}</Badge></Fact>
        <Fact label="Période">{`${formatDateFr(preview.periodFrom)} au ${formatDateFr(preview.periodTo)}`}</Fact>
        <Fact label="Lignes lues">{String(preview.linesTotal)}</Fact>
        <Fact label="Seront importées">{String(preview.wouldImport)}</Fact>
        <Fact label="Doublons ignorés">{String(preview.wouldDuplicate)}</Fact>
        <Fact label="Refusées">{String(preview.rejected.length)}</Fact>
      </dl>
      <RejectedList rejected={preview.rejected} total={preview.rejected.length} />
      <Table aria-label="Premières lignes du relevé">
        <TableHead>
          <TableRow>
            <TableHeaderCell>N°</TableHeaderCell>
            <TableHeaderCell>Date</TableHeaderCell>
            <TableHeaderCell>Libellé</TableHeaderCell>
            <TableHeaderCell numeric>Montant</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {preview.lines.map((line) => (
            <TableRow key={line.number}>
              <TableCell>{String(line.number)}</TableCell>
              <TableCell>{formatDateFr(line.bookingDate)}</TableCell>
              <TableCell>{line.label}</TableCell>
              <TableCell numeric>{moneyText(line.amount)}{line.direction === 'debit' ? ' (débit)' : ' (crédit)'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {preview.lines.length < preview.linesTotal ? <p className="text-caption text-fg-subtle">{`Aperçu des ${String(preview.lines.length)} premières lignes sur ${String(preview.linesTotal)}.`}</p> : null}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-caption text-fg-subtle">{label}</dt>
      <dd className="font-medium text-fg">{children}</dd>
    </div>
  );
}
