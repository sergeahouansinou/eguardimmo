'use client';

import { Badge, Checkbox, IconButton, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Check, EyeOff, FilePlus, Link2, RotateCcw, Undo2 } from 'lucide-react';
import { actionLabel, confidenceBadge, explanationText, ignoreReasonLabel, moneyText } from './labels';
import type { BankLine, LineState } from './model';
import { formatDateFr } from '../../locataires/kit/dates';

export type LineAction = 'accept' | 'match' | 'settle' | 'ignore' | 'undo' | 'restore';

export const isAcceptable = (line: BankLine): boolean => line.suggestion !== null && line.suggestion.confidence !== 'weak';

export function LinesTable({ lines, state, selected, writable, onToggle, onAction }: {
  lines: readonly BankLine[];
  state: LineState;
  selected: readonly string[];
  writable: boolean;
  onToggle: (lineId: string) => void;
  onAction: (action: LineAction, line: BankLine) => void;
}) {
  const unmatched = state === 'unmatched';
  return (
    <Table aria-label="Lignes du relevé">
      <TableHead>
        <TableRow>
          {unmatched ? <TableHeaderCell>Choix</TableHeaderCell> : null}
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell>Libellé</TableHeaderCell>
          <TableHeaderCell numeric>Montant</TableHeaderCell>
          <TableHeaderCell>{state === 'ignored' ? 'Motif' : unmatched ? 'Proposition' : 'Pointage'}</TableHeaderCell>
          {writable ? <TableHeaderCell>Actions</TableHeaderCell> : null}
        </TableRow>
      </TableHead>
      <TableBody>
        {lines.map((line) => (
          <TableRow key={line.id}>
            {unmatched ? (
              <TableCell>
                {isAcceptable(line) ? <Checkbox label={`Choisir la ligne du ${formatDateFr(line.bookingDate)}`} hideLabel checked={selected.includes(line.id)} onChange={() => { onToggle(line.id); }} /> : null}
              </TableCell>
            ) : null}
            <TableCell>{formatDateFr(line.bookingDate)}</TableCell>
            <TableCell>
              {line.label}
              {line.counterpartyName ? <span className="block text-caption text-fg-subtle">{`${line.counterpartyName}${line.counterpartyLast4 ? ` · ••••${line.counterpartyLast4}` : ''}`}</span> : null}
            </TableCell>
            <TableCell numeric>{moneyText(line.signedAmount, { signed: true })}</TableCell>
            <TableCell><Detail line={line} state={state} /></TableCell>
            {writable ? (
              <TableCell>
                <span className="flex items-center gap-1">
                  {unmatched ? (
                    <>
                      {isAcceptable(line) ? <IconButton label={`Valider la proposition pour la ligne du ${formatDateFr(line.bookingDate)}`} icon={Check} onClick={() => { onAction('accept', line); }} /> : null}
                      <IconButton label={`Pointer la ligne du ${formatDateFr(line.bookingDate)} avec des écritures`} icon={Link2} onClick={() => { onAction('match', line); }} />
                      <IconButton label={`Créer l’écriture depuis la ligne du ${formatDateFr(line.bookingDate)}`} icon={FilePlus} onClick={() => { onAction('settle', line); }} />
                      <IconButton label={`Ignorer la ligne du ${formatDateFr(line.bookingDate)}`} icon={EyeOff} onClick={() => { onAction('ignore', line); }} />
                    </>
                  ) : null}
                  {state === 'matched' && line.matchId !== null ? <IconButton label={`Défaire le pointage de la ligne du ${formatDateFr(line.bookingDate)}`} icon={Undo2} variant="danger" onClick={() => { onAction('undo', line); }} /> : null}
                  {state === 'ignored' ? <IconButton label={`Restaurer la ligne du ${formatDateFr(line.bookingDate)}`} icon={RotateCcw} onClick={() => { onAction('restore', line); }} /> : null}
                </span>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Detail({ line, state }: { line: BankLine; state: LineState }) {
  if (state === 'ignored') return <>{line.ignoreReason ? ignoreReasonLabel[line.ignoreReason] : 'Ignorée'}</>;
  if (state === 'matched') return <Badge tone="success">Pointée</Badge>;
  if (line.suggestion === null) return <span className="text-caption text-fg-subtle">Aucune proposition</span>;
  const badge = confidenceBadge[line.suggestion.confidence];
  return (
    <span className="flex flex-col gap-0.5">
      <span className="flex flex-wrap items-center gap-1">
        <Badge tone={badge.tone}>{badge.label}</Badge>
        <span>{actionLabel[line.suggestion.action]}</span>
      </span>
      <span className="text-caption text-fg-subtle">{explanationText(line.suggestion.codes)}</span>
    </span>
  );
}
