'use client';

import { Alert, Button, Checkbox, Dialog, DialogClose, DialogContent, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { useBookLines, useMatchLine } from './hooks';
import { moneyText } from './labels';
import type { BankLine, BookLine } from './model';
import { ActionError } from './parts/ActionError';
import { QueryState } from './parts/states';
import { CursorPager, useCursorPages } from '../rent/CursorPager';
import { NoRows, useNotify } from '../../locataires/kit';
import { addDays, formatDateFr } from '../../locataires/kit/dates';
import { useAttemptKey } from '../ownerfunds/attemptKey';

const WINDOW_DAYS = 31;

export function MatchDialog({ line, onClose }: { line: BankLine | null; onClose: () => void }) {
  return (
    <Dialog open={line !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Pointer avec des écritures" description="Choisissez les écritures du grand livre qui correspondent à cette ligne. Leur total doit égaler le montant de la ligne." className="max-w-[760px]">
        {line ? <MatchBody line={line} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

const signedBook = (book: BookLine): number => (book.side === 'debit' ? book.amount.amount : -book.amount.amount);

function MatchBody({ line, onClose }: { line: BankLine; onClose: () => void }) {
  const match = useMatchLine();
  const notify = useNotify();
  const attemptKey = useAttemptKey();
  const pages = useCursorPages();
  const [from, setFrom] = useState(addDays(line.bookingDate, -WINDOW_DAYS));
  const [to, setTo] = useState(addDays(line.bookingDate, WINDOW_DAYS));
  const [selected, setSelected] = useState<Readonly<Record<string, BookLine>>>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const books = useBookLines({ accountId: line.bankAccountId, side: null, amount: null, from: from === '' ? null : from, to: to === '' ? null : to, cursor: pages.cursor });

  const chosen = Object.values(selected);
  const difference = chosen.reduce((total, book) => total + signedBook(book), 0) - line.signedAmount.amount;
  const toggle = (book: BookLine) => {
    setSelected((current) => {
      const { [book.lineId]: removed, ...rest } = current;
      return removed === undefined ? { ...current, [book.lineId]: book } : rest;
    });
  };

  const submit = async () => {
    setFailure(null);
    setBusy(true);
    const ids = chosen.map((book) => book.lineId);
    try {
      await match.mutateAsync({ lineId: line.id, otherLineIds: [], journalLineIds: ids, lockVersion: line.lockVersion, key: attemptKey(JSON.stringify([line.id, [...ids].sort(), line.lockVersion])) });
      notify({ title: 'Pointage enregistré', description: 'La ligne est pointée avec les écritures choisies.' });
      onClose();
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-4">
      <p className="text-body text-fg-muted">{`${formatDateFr(line.bookingDate)} · ${moneyText(line.signedAmount, { signed: true })}`}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <TextField label="Écritures à partir du" type="date" placeholder="AAAA-MM-JJ" value={from} onChange={(event) => { setFrom(event.target.value); pages.reset(); }} />
        <TextField label="Écritures jusqu’au" type="date" placeholder="AAAA-MM-JJ" value={to} onChange={(event) => { setTo(event.target.value); pages.reset(); }} />
      </div>
      {books.data === undefined ? (
        <QueryState query={books} label="Chargement des écritures" title="Impossible de charger les écritures" />
      ) : books.data.items.length === 0 ? (
        <NoRows>Aucune écriture non pointée sur cette période.</NoRows>
      ) : (
        <>
          <Table aria-label="Écritures non pointées">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Choix</TableHeaderCell>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Écriture</TableHeaderCell>
                <TableHeaderCell numeric>Montant</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {books.data.items.map((book) => (
                <TableRow key={book.lineId}>
                  <TableCell>
                    <Checkbox label={`Choisir l’écriture ${book.entryReference ?? book.entryLabel ?? ''}`} hideLabel checked={selected[book.lineId] !== undefined} disabled={book.isReversed} onChange={() => { toggle(book); }} />
                  </TableCell>
                  <TableCell>{formatDateFr(book.entryDate)}</TableCell>
                  <TableCell>{[book.entryReference, book.entryLabel].filter(Boolean).join(' · ') || 'Écriture'}</TableCell>
                  <TableCell numeric>{moneyText({ amount: signedBook(book), currency: book.amount.currency }, { signed: true })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <CursorPager pages={pages} nextCursor={books.data.nextCursor} label="Pagination des écritures" />
        </>
      )}
      <Alert tone={chosen.length > 0 && difference === 0 ? 'success' : 'info'} title={chosen.length === 0 ? 'Aucune écriture choisie' : difference === 0 ? 'Montants égaux' : 'Écart à combler'}>
        {chosen.length === 0 ? 'Cochez au moins une écriture.' : difference === 0 ? 'Le total des écritures égale la ligne du relevé.' : `Écart : ${moneyText({ amount: difference, currency: line.amount.currency }, { signed: true })}. Ajoutez ou retirez des écritures.`}
      </Alert>
      {failure === null ? null : <ActionError title="Pointage non enregistré" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button variant="primary" loading={busy} disabled={chosen.length === 0 || difference !== 0} onClick={() => { void submit(); }}>Pointer la ligne</Button>
      </div>
    </div>
  );
}
