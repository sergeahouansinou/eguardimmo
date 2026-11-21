'use client';

import { Button, Checkbox, Dialog, DialogClose, DialogContent } from '@eguardimmo/ui';
import { useState } from 'react';
import { useAddItems, useUnpaid } from './hooks';
import type { RecoveryCase, UnpaidItem } from './model';
import { CursorPager, useCursorPages } from '../rent/CursorPager';
import { moneyText } from '../rent/labels';
import { receivableTitle } from './labels';
import { ListLoading, LoadError, errorMessage, useNotify } from '../../locataires/kit';

export function AddItemsDialog({ recoveryCase, open, onClose }: { recoveryCase: RecoveryCase; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Ajouter des créances" description={`Impayés échus de ${recoveryCase.debtorName ?? 'ce locataire'} sur ce bail, hors dossier actif.`} className="max-w-[560px]">
        {open ? <Candidates recoveryCase={recoveryCase} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function toggled(current: ReadonlyMap<string, UnpaidItem>, item: UnpaidItem, checked: boolean): ReadonlyMap<string, UnpaidItem> {
  const next = new Map(current);
  if (checked) next.set(item.itemId, item);
  else next.delete(item.itemId);
  return next;
}

const candidate = (item: UnpaidItem, recoveryCase: RecoveryCase): boolean => item.caseRef === null && item.partyId === recoveryCase.debtorId;

function Candidates({ recoveryCase, onClose }: { recoveryCase: RecoveryCase; onClose: () => void }) {
  const notify = useNotify();
  const add = useAddItems();
  const pages = useCursorPages();
  const [chosen, setChosen] = useState<ReadonlyMap<string, UnpaidItem>>(new Map());
  const unpaid = useUnpaid({ leaseId: recoveryCase.leaseId, after: pages.cursor });
  const rows = (unpaid.data?.items ?? []).filter((item) => candidate(item, recoveryCase));

  const submit = async () => {
    try {
      const items = [...chosen.values()];
      const ids = { installmentIds: items.filter((item) => item.type === 'installment').map((item) => item.itemId), invoiceIds: items.filter((item) => item.type === 'invoice').map((item) => item.itemId) };
      const updated = await add.mutateAsync({ caseId: recoveryCase.id, ids });
      notify({ title: 'Créances ajoutées', description: `Le dossier compte maintenant ${String(updated.itemsCount)} créance${updated.itemsCount > 1 ? 's' : ''}.` });
      onClose();
    } catch (error) {
      notify({ tone: 'danger', title: 'Ajout impossible', description: errorMessage(error) });
    }
  };

  return (
    <div className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto p-4">
      {unpaid.isError ? <LoadError title={unpaid.error?.message ?? 'Les impayés n’ont pas pu être chargés'} /> : null}
      {unpaid.isPending && !unpaid.isError ? <ListLoading label="Chargement des impayés" /> : null}
      {unpaid.data && rows.length === 0 ? <p className="text-body text-fg-subtle">Aucune autre créance impayée à ajouter pour ce locataire.</p> : null}
      {rows.length > 0 ? (
        <ul aria-label="Créances disponibles" className="flex flex-col gap-2">
          {rows.map((item) => (
            <li key={item.itemId} className="flex items-center justify-between gap-2 rounded-md border border-line p-2">
              <Checkbox
                label={`${receivableTitle(item)}, reste dû ${moneyText(item.outstanding)}`}
                checked={chosen.has(item.itemId)}
                onChange={(event) => { setChosen((current) => toggled(current, item, event.target.checked)); }}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <CursorPager pages={pages} nextCursor={unpaid.data?.nextAfter ?? null} label="Pagination des créances disponibles" />
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Annuler</Button>
        </DialogClose>
        <Button loading={add.isPending} disabled={chosen.size === 0} onClick={() => { void submit(); }}>Ajouter au dossier</Button>
      </div>
    </div>
  );
}
