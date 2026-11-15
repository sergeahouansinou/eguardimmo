'use client';

import { ArrowDown, ArrowUp, Copy, FileSearch, Paperclip, Pencil, CircleX } from 'lucide-react';
import { useRef, useState } from 'react';
import { Alert, Button, Checkbox, ConfirmDialog, Icon, MenuItem, MenuSeparator, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { downloadCsv } from '../csv';
import { formatDate } from '../dates';
import { checkAttachment } from '../forms';
import { formatMoneyInput } from '../money';
import { sum } from '../money';
import { EmptyBlock, EtatBadge, FINANCES_ROUTES, PagedFooter, PAGE_SIZE, useSelection } from '../parts';
import type { ScreenProps } from '../parts';
import { RowMenu } from '../RowMenu';
import type { Echeance, FinancesData } from '../schemas';
import { EditEcheanceDialog } from './EditEcheanceDialog';
import { bienLabel } from './rows';
import type { EcheanceRow } from './rows';
import { ShiftDialog } from './ShiftDialog';
import type { useExec } from '../parts';

type Exec = ReturnType<typeof useExec>;

export function EcheancesTab({
  data,
  rows,
  direction,
  onDirection,
  page,
  onPage,
  money,
  exec,
  navigate,
  filtered,
}: Pick<ScreenProps, 'navigate'> & {
  data: FinancesData;
  rows: EcheanceRow[];
  direction: 'asc' | 'desc';
  onDirection: () => void;
  page: number;
  onPage: (page: number) => void;
  money: (minor: number) => string;
  exec: Exec;
  filtered: boolean;
}) {
  const selection = useSelection();
  const [editing, setEditing] = useState<Echeance | null>(null);
  const [shifting, setShifting] = useState(false);
  const [cancelling, setCancelling] = useState<Echeance | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const attachTarget = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const chosen = rows.filter((row) => selection.selected.has(row.echeance.id));
  const chosenIds = chosen.map((row) => row.echeance.id);
  const allChecked = visible.length > 0 && visible.every((row) => selection.selected.has(row.echeance.id));
  const base = chosen.length > 0 ? chosen : rows;
  const restant = sum(base.map((row) => Math.max(0, row.reste)));
  const canRemind = chosen.some((row) => row.reste > 0);

  const primary = (row: EcheanceRow) => {
    const id = row.echeance.id;
    if (row.etat === 'retard') return { label: 'Relancer', run: () => { exec.run({ type: 'sendReminders', echeanceIds: [id], canal: 'email' }); } };
    if (row.etat === 'trop_percu') return { label: 'Reporter', run: () => { exec.run({ type: 'carryCredit', echeanceId: id }); } };
    return { label: 'Enregistrer', run: () => { navigate(`${FINANCES_ROUTES.encaisser}?echeance=${id}`); } };
  };

  const exportRows = () => {
    downloadCsv('operations-a-encaisser.csv', [
      ['Échéance', 'Locataire', 'Bien', 'Libellé', 'Montant', 'Payé', 'Reste dû'],
      ...base.map((row) => [formatDate(row.echeance.echeance), row.bail.locataire, bienLabel(row.bail), row.echeance.libelle, formatMoneyInput(row.echeance.montant), formatMoneyInput(row.echeance.paye), formatMoneyInput(row.reste)]),
    ]);
  };

  return (
    <div className="flex flex-col gap-2">
      {fileError ? (
        <Alert tone="danger" title="Justificatif refusé">
          {fileError}
        </Alert>
      ) : null}
      {exec.error ? (
        <Alert tone="danger" title="L’opération n’a pas été enregistrée">
          {exec.error.message}
        </Alert>
      ) : null}
      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"
        tabIndex={-1}
        aria-label="Justificatif à joindre"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          const target = attachTarget.current;
          if (!file || !target) return;
          const problem = checkAttachment(file);
          setFileError(problem);
          if (!problem) exec.run({ type: 'attachJustificatif', echeanceId: target, fileName: file.name });
        }}
      />
      {chosen.length > 0 ? (
        <div role="region" aria-label="Actions sur la sélection" className="flex flex-wrap items-center gap-2 rounded-md bg-action-subtle px-2 py-1.5 text-body-strong text-action-on-subtle">
          <span>{chosen.length} sélectionné{chosen.length > 1 ? 's' : ''}</span>
          <Button size="sm" disabled={!canRemind} onClick={() => { exec.run({ type: 'sendReminders', echeanceIds: chosen.filter((row) => row.reste > 0).map((row) => row.echeance.id), canal: 'email' }, { onDone: selection.clear }); }}>
            Relancer
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { setShifting(true); }}>
            Modifier les lignes
          </Button>
          <Button size="sm" variant="ghost" onClick={exportRows}>
            Exporter
          </Button>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <EmptyBlock title={filtered ? 'Aucune échéance ne correspond aux filtres' : 'Rien à encaisser'}>
          {filtered ? 'Modifiez ou effacez les filtres pour élargir la période.' : 'Toutes les échéances de la période sont soldées.'}
        </EmptyBlock>
      ) : (
        <Table aria-label="Échéances à encaisser">
          <TableHead>
            <tr>
              <TableHeaderCell className="w-8">
                <Checkbox label="Tout sélectionner" hideLabel checked={allChecked} onChange={(event) => { selection.setAll(visible.map((row) => row.echeance.id), event.target.checked); }} />
              </TableHeaderCell>
              <TableHeaderCell aria-sort={direction === 'asc' ? 'ascending' : 'descending'}>
                <button type="button" onClick={onDirection} className="inline-flex cursor-pointer items-center gap-1 text-action-on-subtle">
                  Échéance
                  <Icon icon={direction === 'asc' ? ArrowUp : ArrowDown} size={14} />
                  <span className="sr-only">Inverser le tri</span>
                </button>
              </TableHeaderCell>
              <TableHeaderCell>Locataire</TableHeaderCell>
              <TableHeaderCell>Bien</TableHeaderCell>
              <TableHeaderCell>Libellé</TableHeaderCell>
              <TableHeaderCell numeric>Montant</TableHeaderCell>
              <TableHeaderCell numeric>Payé</TableHeaderCell>
              <TableHeaderCell numeric>Reste dû</TableHeaderCell>
              <TableHeaderCell>État</TableHeaderCell>
              <TableHeaderCell>Action</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {visible.map((row) => {
              const action = primary(row);
              const { echeance } = row;
              return (
                <TableRow key={echeance.id} selected={selection.selected.has(echeance.id)}>
                  <TableCell>
                    <Checkbox label={`Sélectionner ${row.bail.locataire}, ${echeance.libelle}`} hideLabel checked={selection.selected.has(echeance.id)} onChange={() => { selection.toggle(echeance.id); }} />
                  </TableCell>
                  <TableCell>{formatDate(echeance.echeance)}</TableCell>
                  <TableCell strong>{row.bail.locataire}</TableCell>
                  <TableCell>{bienLabel(row.bail)}</TableCell>
                  <TableCell>
                    {echeance.libelle}
                    {echeance.justificatifs.length > 0 ? <span className="ml-1 text-caption text-fg-subtle">({echeance.justificatifs.length} pièce{echeance.justificatifs.length > 1 ? 's' : ''})</span> : null}
                  </TableCell>
                  <TableCell numeric>{money(echeance.montant)}</TableCell>
                  <TableCell numeric>{money(echeance.paye)}</TableCell>
                  <TableCell numeric className={row.reste > 0 && row.etat === 'retard' ? 'font-semibold text-fg-danger' : undefined}>
                    {row.reste < 0 ? `+${money(-row.reste)}` : money(row.reste)}
                  </TableCell>
                  <TableCell>
                    <EtatBadge etat={row.etat} jours={row.jours} />
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1">
                      <Button variant="link" size="sm" onClick={action.run}>
                        {action.label}
                      </Button>
                      <RowMenu>
                        <MenuItem icon={FileSearch} onSelect={() => { navigate('/documents/avis-echeance'); }}>Aperçu de l’avis (PDF)</MenuItem>
                        <MenuItem icon={Pencil} onSelect={() => { setEditing(echeance); }}>Modifier</MenuItem>
                        <MenuItem icon={Copy} onSelect={() => { exec.run({ type: 'duplicateEcheance', echeanceId: echeance.id }); }}>Dupliquer</MenuItem>
                        <MenuItem icon={Paperclip} onSelect={() => { attachTarget.current = echeance.id; fileInput.current?.click(); }}>Joindre un justificatif</MenuItem>
                        <MenuSeparator />
                        <MenuItem icon={CircleX} tone="danger" disabled={echeance.paye > 0} onSelect={() => { setCancelling(echeance); }}>Annuler l’avis d’échéance</MenuItem>
                      </RowMenu>
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <PagedFooter
        page={page}
        total={rows.length}
        onPageChange={onPage}
        label="Pagination des échéances"
        extra={rows.length > 0 ? <>{chosen.length > 0 ? 'Reste dû sur la sélection' : 'Reste dû sur la liste'} : <b className="text-fg">{money(restant)}</b></> : null}
      />
      <EditEcheanceDialog
        echeance={editing}
        pending={exec.pending}
        error={exec.error}
        onClose={() => { setEditing(null); exec.reset(); }}
        onSubmit={(values) => { if (editing) exec.run({ type: 'updateEcheance', echeanceId: editing.id, ...values }, { onDone: () => { setEditing(null); } }); }}
      />
      <ShiftDialog
        open={shifting}
        count={chosen.length}
        today={data.today}
        pending={exec.pending}
        error={exec.error}
        onClose={() => { setShifting(false); exec.reset(); }}
        onSubmit={(echeance) => { exec.run({ type: 'shiftEcheances', echeanceIds: chosenIds, echeance }, { onDone: () => { setShifting(false); selection.clear(); } }); }}
      />
      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => { if (!open) setCancelling(null); }}
        title="Annuler l’avis d’échéance ?"
        description={cancelling ? `L’avis « ${cancelling.libelle} » n’est plus appelé. Il reste consultable.` : ''}
        confirmLabel="Annuler l’avis"
        tone="danger"
        loading={exec.pending}
        onConfirm={() => { if (cancelling) exec.run({ type: 'cancelEcheance', echeanceId: cancelling.id }, { onDone: () => { setCancelling(null); }, onError: () => { setCancelling(null); } }); }}
      />
    </div>
  );
}

