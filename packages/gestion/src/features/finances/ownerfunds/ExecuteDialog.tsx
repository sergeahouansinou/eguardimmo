'use client';

import { Alert, Button, Checkbox, Dialog, DialogClose, DialogContent, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { OwnerFundsApiError } from './api/ownerFundsErrors';
import { useAttemptKey } from './attemptKey';
import { useExecuteItem } from './hooks';
import { moneyText } from './labels';
import type { PayoutBatch, PayoutItem } from './model';
import { ActionError } from './parts';
import { useNotify } from '../../locataires/kit';
import { todayIso } from '../../locataires/kit/dates';

export interface ExecuteTarget {
  batch: PayoutBatch;
  item: PayoutItem;
  name: string;
}

export function ExecuteDialog({ target, onClose }: { target: ExecuteTarget | null; onClose: () => void }) {
  return (
    <Dialog open={target !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        title="Exécuter le virement"
        description={target ? `Après avoir viré ${moneyText(target.item.netAmount)} à ${target.name} depuis la banque de tiers, saisissez la date et la référence du virement.` : ''}
        className="max-w-[480px]"
      >
        {target ? <ExecuteForm key={target.item.id} target={target} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ExecuteForm({ target, onClose }: { target: ExecuteTarget; onClose: () => void }) {
  const execute = useExecuteItem();
  const notify = useNotify();
  const keyFor = useAttemptKey();
  const today = todayIso();
  const [executedOn, setExecutedOn] = useState(today);
  const [reference, setReference] = useState('');
  const [acknowledge, setAcknowledge] = useState(false);
  const [errors, setErrors] = useState<{ executedOn?: string; reference?: string }>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [needsAcknowledgement, setNeedsAcknowledgement] = useState(false);

  const submit = async () => {
    const next: { executedOn?: string; reference?: string } = {};
    if (executedOn === '' || executedOn > today) next.executedOn = 'Indiquez la date du virement, au plus tard aujourd’hui.';
    if (reference.trim() !== '' && !/^[A-Za-z0-9._/-]{1,64}$/.test(reference.trim())) next.reference = 'La référence compte 64 caractères au plus : lettres, chiffres, point, tiret, barre oblique ou souligné.';
    setErrors(next);
    setFailure(null);
    if (Object.keys(next).length > 0) return;
    try {
      await execute.mutateAsync({
        batchId: target.batch.id,
        itemId: target.item.id,
        input: { executedOn, reference, acknowledgeAccountChange: acknowledge },
        key: keyFor(JSON.stringify([target.item.id, executedOn, reference, acknowledge])),
      });
      notify({ title: 'Virement enregistré', description: `${target.name} : ${moneyText(target.item.netAmount)} reversés.` });
      onClose();
    } catch (error) {
      if (error instanceof OwnerFundsApiError && error.code === 'payout_account_changed') setNeedsAcknowledgement(true);
      setFailure(error);
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void submit();
      }}
    >
      {target.batch.secondApproverRequired ? (
        <Alert tone="info" title="Second approbateur requis">Le virement doit être exécuté par une autre personne que celle qui a validé le lot.</Alert>
      ) : null}
      <TextField label="Date du virement *" type="date" placeholder="AAAA-MM-JJ" max={today} min="2000-01-01" value={executedOn} error={errors.executedOn} onChange={(event) => { setExecutedOn(event.target.value); }} data-autofocus />
      <TextField label="Référence bancaire" placeholder="Ex. VIR-20261116-0042" maxLength={64} value={reference} error={errors.reference} onChange={(event) => { setReference(event.target.value); }} />
      {needsAcknowledgement ? (
        <Checkbox label="Je reconnais le changement du compte de paiement : le virement part vers l’ancien compte figé sur le lot" checked={acknowledge} onChange={(event) => { setAcknowledge(event.target.checked); }} />
      ) : null}
      {failure === null ? null : <ActionError title="Virement non enregistré" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={execute.isPending}>Enregistrer le virement</Button>
      </div>
    </form>
  );
}
