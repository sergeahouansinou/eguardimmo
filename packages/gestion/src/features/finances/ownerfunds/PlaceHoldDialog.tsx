'use client';

import { Button, Dialog, DialogClose, DialogContent, Select, TextField, Textarea } from '@eguardimmo/ui';
import { useState } from 'react';
import { amountHint } from '../invoicing/amounts';
import { useAttemptKey } from './attemptKey';
import { usePlaceHold } from './hooks';
import { holdKindLabel, holdReasonLabel } from './labels';
import { HOLD_KINDS, HOLD_REASONS } from './model';
import type { HoldKind, HoldReason, Money } from './model';
import { ActionError } from './parts';
import { parseMinorUnits } from '../rent/api/rentPayloads';
import { useNotify } from '../../locataires/kit';

const kindOptions = HOLD_KINDS.map((kind) => ({ value: kind, label: holdKindLabel[kind] }));
const reasonOptions = HOLD_REASONS.map((reason) => ({ value: reason, label: holdReasonLabel[reason] }));
const isKind = (value: string): value is HoldKind => HOLD_KINDS.some((kind) => kind === value);
const isReason = (value: string): value is HoldReason => HOLD_REASONS.some((reason) => reason === value);

export interface HoldTarget {
  mandantId: string;
  name: string;
  currency: Money['currency'];
}

export function PlaceHoldDialog({ target, onClose }: { target: HoldTarget | null; onClose: () => void }) {
  return (
    <Dialog open={target !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Poser une retenue" description={target ? `Retenue sur le net reversable de ${target.name}. Elle ne déplace aucun argent.` : ''} className="max-w-[480px]">
        {target ? <HoldForm key={target.mandantId} target={target} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function HoldForm({ target, onClose }: { target: HoldTarget; onClose: () => void }) {
  const place = usePlaceHold();
  const notify = useNotify();
  const keyFor = useAttemptKey();
  const [kind, setKind] = useState<HoldKind>('full');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<HoldReason>('dispute');
  const [comment, setComment] = useState('');
  const [amountError, setAmountError] = useState<string | undefined>();
  const [failure, setFailure] = useState<unknown>(null);

  const submit = async () => {
    setFailure(null);
    const minor = parseMinorUnits(amount, target.currency);
    if (kind === 'reserve' && (minor === null || minor <= 0)) {
      setAmountError(`Indiquez le montant à réserver. ${amountHint(target.currency)}.`);
      return;
    }
    setAmountError(undefined);
    try {
      await place.mutateAsync({
        input: { mandantId: target.mandantId, kind, amount, currency: target.currency, reason, comment },
        key: keyFor(JSON.stringify([target.mandantId, kind, amount, reason, comment])),
      });
      notify({ title: 'Retenue posée', description: `${target.name} : le net reversible est recalculé par le serveur.` });
      onClose();
    } catch (error) {
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
      <Select label="Type de retenue *" placeholder="Type" options={kindOptions} value={kind} onValueChange={(value) => { if (isKind(value)) setKind(value); }} />
      {kind === 'reserve' ? (
        <TextField label="Montant réservé *" placeholder={amountHint(target.currency)} inputMode="decimal" value={amount} error={amountError} onChange={(event) => { setAmount(event.target.value); }} />
      ) : null}
      <Select label="Motif *" placeholder="Motif" options={reasonOptions} value={reason} onValueChange={(value) => { if (isReason(value)) setReason(value); }} />
      <Textarea label="Commentaire" placeholder="Précisions utiles à l’équipe" rows={3} maxLength={500} value={comment} onChange={(event) => { setComment(event.target.value); }} />
      {failure === null ? null : <ActionError title="Retenue non posée" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={place.isPending}>Poser la retenue</Button>
      </div>
    </form>
  );
}
