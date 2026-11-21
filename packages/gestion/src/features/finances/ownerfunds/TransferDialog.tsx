'use client';

import { Button, Dialog, DialogClose, DialogContent, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { amountHint } from '../invoicing/amounts';
import { useAttemptKey } from './attemptKey';
import { useRequestDeposit, useWithdrawFees } from './hooks';
import type { Money } from './model';
import { ActionError } from './parts';
import { parseMinorUnits } from '../rent/api/rentPayloads';
import { useNotify } from '../../locataires/kit';
import { todayIso } from '../../locataires/kit/dates';

export type TransferMode = 'withdraw' | 'deposit';

const COPY: Record<TransferMode, { title: string; description: string; submit: string; done: string; doneDetail: string; failure: string }> = {
  withdraw: {
    title: 'Prélever les honoraires',
    description: 'Virement du compte de tiers vers le compte de l’agence, plafonné par le serveur à l’excédent. Saisissez le virement après l’avoir effectué à la banque.',
    submit: 'Enregistrer le prélèvement',
    done: 'Prélèvement enregistré',
    doneDetail: 'L’excédent du compte de tiers est recalculé par le serveur.',
    failure: 'Prélèvement non enregistré',
  },
  deposit: {
    title: 'Enregistrer un apport',
    description: 'Apport de l’agence sur le compte de tiers. Il reste « à confirmer » jusqu’à la confirmation par un second approbateur.',
    submit: 'Demander l’apport',
    done: 'Apport demandé',
    doneDetail: 'Il doit maintenant être confirmé par un second approbateur.',
    failure: 'Apport non enregistré',
  },
};

export function TransferDialog({ mode, currency, open, onClose }: { mode: TransferMode; currency: Money['currency']; open: boolean; onClose: () => void }) {
  const copy = COPY[mode];
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title={copy.title} description={copy.description} className="max-w-[480px]">
        {open ? <TransferForm mode={mode} currency={currency} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function TransferForm({ mode, currency, onClose }: { mode: TransferMode; currency: Money['currency']; onClose: () => void }) {
  const copy = COPY[mode];
  const withdraw = useWithdrawFees();
  const deposit = useRequestDeposit();
  const notify = useNotify();
  const keyFor = useAttemptKey();
  const today = todayIso();
  const [amount, setAmount] = useState('');
  const [executedOn, setExecutedOn] = useState(today);
  const [reference, setReference] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; executedOn?: string; reference?: string }>({});
  const [failure, setFailure] = useState<unknown>(null);
  const pending = mode === 'withdraw' ? withdraw.isPending : deposit.isPending;

  const submit = async () => {
    const minor = parseMinorUnits(amount, currency);
    const trimmed = reference.trim();
    const next: { amount?: string; executedOn?: string; reference?: string } = {};
    if (minor === null || minor <= 0) next.amount = `Indiquez un montant strictement positif. ${amountHint(currency)}.`;
    if (executedOn === '' || executedOn > today) next.executedOn = 'Indiquez la date du virement, au plus tard aujourd’hui.';
    if (mode === 'deposit' ? !/^[A-Za-z0-9._/-]{3,64}$/.test(trimmed) : trimmed !== '' && !/^[A-Za-z0-9._/-]{1,64}$/.test(trimmed)) {
      next.reference = 'La référence bancaire compte 3 à 64 caractères : lettres, chiffres, point, tiret, barre oblique ou souligné.';
    }
    setErrors(next);
    setFailure(null);
    if (Object.keys(next).length > 0) return;
    const input = { amount, currency, executedOn, reference };
    const key = keyFor(JSON.stringify([mode, amount, executedOn, trimmed]));
    try {
      if (mode === 'withdraw') await withdraw.mutateAsync({ input, key });
      else await deposit.mutateAsync({ input, key });
      notify({ title: copy.done, description: copy.doneDetail });
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
      <TextField label="Montant *" placeholder={amountHint(currency)} inputMode="decimal" value={amount} error={errors.amount} onChange={(event) => { setAmount(event.target.value); }} data-autofocus />
      <TextField label="Date du virement *" type="date" placeholder="AAAA-MM-JJ" max={today} min="2000-01-01" value={executedOn} error={errors.executedOn} onChange={(event) => { setExecutedOn(event.target.value); }} />
      <TextField
        label={mode === 'deposit' ? 'Référence bancaire *' : 'Référence bancaire'}
        placeholder="Ex. VIR-20261116-0042"
        maxLength={64}
        value={reference}
        error={errors.reference}
        onChange={(event) => { setReference(event.target.value); }}
      />
      {failure === null ? null : <ActionError title={copy.failure} error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={pending}>{copy.submit}</Button>
      </div>
    </form>
  );
}
