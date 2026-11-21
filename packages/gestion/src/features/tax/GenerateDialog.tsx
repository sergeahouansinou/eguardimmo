'use client';

import { Badge, Button, Checkbox, Dialog, DialogClose, DialogContent, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { useRef, useState } from 'react';
import { newKey } from '../finances/ownerfunds/attemptKey';
import { useGestionNavigation } from '../locataires/kit';
import { errorMessage } from '../locataires/kit';
import { useGenerateStatements } from './hooks';
import type { GenerationResult, MandantChoice } from './model';
import { SUPPORTED_YEAR } from './model';
import { taxPaths } from './paths';

export const BATCH_SIZE = 10;

type RowState = { status: 'waiting' } | { status: 'running' } | { status: 'done'; result: GenerationResult } | { status: 'failed'; message: string };

const chunk = <T,>(items: readonly T[], size: number): T[][] => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

export function GenerateDialog({ open, mandants, loading, onClose }: { open: boolean; mandants: readonly MandantChoice[]; loading: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title={`Générer les relevés ${String(SUPPORTED_YEAR)}`} description={`Choisissez les mandants : la génération se fait par lots de ${String(BATCH_SIZE)}. Chaque relevé est calculé par le serveur et reste à publier.`} className="max-w-[560px]">
        {open ? <GenerateForm mandants={mandants} loading={loading} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function GenerateForm({ mandants, loading }: { mandants: readonly MandantChoice[]; loading: boolean }) {
  const { Link } = useGestionNavigation();
  const generate = useGenerateStatements();
  const keys = useRef(new Map<string, string>());
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [rows, setRows] = useState<ReadonlyMap<string, RowState> | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const names = new Map(mandants.map((mandant) => [mandant.partyId, mandant.name]));
  const running = progress !== null;

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
    setProblem(null);
  };

  const keyOf = (ids: readonly string[]): string => {
    const signature = JSON.stringify([SUPPORTED_YEAR, [...ids].sort()]);
    const known = keys.current.get(signature);
    if (known !== undefined) return known;
    const created = newKey();
    keys.current.set(signature, created);
    return created;
  };

  const run = async (ids: readonly string[]) => {
    const batches = chunk(ids, BATCH_SIZE);
    const update = (changes: ReadonlyMap<string, RowState>) => { setRows((current) => new Map([...(current ?? []), ...changes])); };
    update(new Map(ids.map((id) => [id, { status: 'waiting' }])));
    setProgress({ done: 0, total: batches.length });
    for (const [position, batch] of batches.entries()) {
      update(new Map(batch.map((id) => [id, { status: 'running' }])));
      try {
        const results = await generate.mutateAsync({ incomeYear: SUPPORTED_YEAR, mandantIds: batch, key: keyOf(batch) });
        const byId = new Map(results.map((result) => [result.mandantId, result]));
        update(new Map(batch.map((id): [string, RowState] => {
          const result = byId.get(id);
          return [id, result === undefined ? { status: 'failed', message: 'Le serveur n’a pas renvoyé de résultat pour ce mandant.' } : { status: 'done', result }];
        })));
      } catch (error) {
        update(new Map(batch.map((id): [string, RowState] => [id, { status: 'failed', message: errorMessage(error) }])));
      }
      setProgress({ done: position + 1, total: batches.length });
    }
    setProgress(null);
  };

  const start = () => {
    if (selected.size === 0) {
      setProblem('Choisissez au moins un mandant.');
      return;
    }
    void run([...selected]);
  };

  const failedIds = [...(rows ?? [])].filter(([, row]) => row.status === 'failed' || (row.status === 'done' && row.result.outcome === 'failed')).map(([id]) => id);

  if (rows !== null) {
    return (
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-4">
        {progress === null ? null : (
          <p role="status" className="text-body text-fg-muted">{`Lot ${String(Math.min(progress.done + 1, progress.total))} sur ${String(progress.total)} en cours`}</p>
        )}
        <Table scrollLabel="Résultat de la génération, défilement horizontal">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Mandant</TableHeaderCell>
              <TableHeaderCell>Résultat</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[...rows].map(([id, row]) => (
              <TableRow key={id}>
                <TableCell strong>{names.get(id) ?? 'Mandant'}</TableCell>
                <TableCell>
                  <ResultCell row={row} Link={Link} onRetry={() => { void run([id]); }} disabled={running} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex flex-wrap justify-end gap-2">
          {failedIds.length > 1 && !running ? <Button variant="secondary" onClick={() => { void run(failedIds); }}>{`Réessayer les ${String(failedIds.length)} échecs`}</Button> : null}
          <DialogClose asChild>
            <Button disabled={running}>Fermer</Button>
          </DialogClose>
        </div>
      </div>
    );
  }

  return (
    <form noValidate className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-4" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); start(); }}>
      {loading ? <p className="text-body text-fg-muted">Chargement des mandants</p> : null}
      {!loading && mandants.length === 0 ? <p className="text-body text-fg-muted">Aucun mandant n’est disponible dans votre agence.</p> : null}
      <fieldset className="flex flex-col gap-1">
        <legend className="text-caption text-fg-muted">Mandants *</legend>
        {mandants.map((mandant) => (
          <Checkbox key={mandant.partyId} label={mandant.name} checked={selected.has(mandant.partyId)} onChange={(event) => { toggle(mandant.partyId, event.target.checked); }} />
        ))}
      </fieldset>
      {problem === null ? null : <p role="alert" className="text-caption text-danger-fg">{problem}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit">{`Générer ${String(selected.size)} relevé${selected.size > 1 ? 's' : ''}`}</Button>
      </div>
    </form>
  );
}

function ResultCell({ row, Link, onRetry, disabled }: { row: RowState; Link: ReturnType<typeof useGestionNavigation>['Link']; onRetry: () => void; disabled: boolean }) {
  if (row.status === 'waiting') return <Badge tone="neutral">En attente</Badge>;
  if (row.status === 'running') return <Badge tone="info">En cours</Badge>;
  const failed = row.status === 'failed' || row.result.outcome === 'failed';
  const message = row.status === 'failed' ? row.message : (row.result.error?.detail ?? '');
  const statement = row.status === 'failed' ? null : row.result.statement;
  const replayed = row.status === 'done' && row.result.outcome === 'replayed';
  return (
    <span className="flex flex-col items-start gap-1">
      {failed ? <Badge tone="danger">Échec</Badge> : <Badge tone="success">{replayed ? 'Déjà généré' : 'Généré'}</Badge>}
      {failed && message !== '' ? <span className="text-caption">{message}</span> : null}
      {statement === null ? null : <Link href={taxPaths.summary(statement.id)} className="text-action-on-subtle underline underline-offset-2">Ouvrir le relevé</Link>}
      {failed ? <Button variant="secondary" size="sm" disabled={disabled} onClick={onRetry}>Réessayer</Button> : null}
    </span>
  );
}
