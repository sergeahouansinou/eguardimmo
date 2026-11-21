'use client';

import { Button, Dialog, DialogClose, DialogContent } from '@eguardimmo/ui';
import { useState } from 'react';
import { useIgnoreLine, useLines } from './hooks';
import { ignoreReasonLabel, moneyText } from './labels';
import { IGNORE_REASONS } from './model';
import type { BankAccount, BankLine } from './model';
import { ActionError } from './parts/ActionError';
import { FormSelect, useBankingForm } from './parts/form';
import { ignoreSchema } from './schemas';
import type { IgnoreValues } from './schemas';
import { formatDateFr } from '../../locataires/kit/dates';
import { useNotify } from '../../locataires/kit';

export function IgnoreDialog({ line, account, onClose }: { line: BankLine | null; account: BankAccount | undefined; onClose: () => void }) {
  return (
    <Dialog open={line !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Ignorer cette ligne" description="Une ligne ignorée sort du pointage et du calcul de l’écart. Elle reste consultable et peut être restaurée." className="max-w-[520px]">
        {line ? <IgnoreForm line={line} paired={account?.ledgerRole === 'trust_bank'} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function IgnoreForm({ line, paired, onClose }: { line: BankLine; paired: boolean; onClose: () => void }) {
  const ignore = useIgnoreLine();
  const notify = useNotify();
  const [failure, setFailure] = useState<unknown>(null);
  const opposite = line.direction === 'credit' ? 'debit' : 'credit';
  const candidates = useLines({ accountId: line.bankAccountId, state: 'unmatched', cursor: null, direction: opposite, amount: line.amount.amount }, { enabled: paired });
  const form = useBankingForm<IgnoreValues, { reason: (typeof IGNORE_REASONS)[number]; pairLineId: string }>(ignoreSchema(paired), { reason: 'internal_transfer', pairLineId: '' });

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await ignore.mutateAsync({ lineId: line.id, reason: values.reason, pairLineId: paired ? values.pairLineId : null, lockVersion: line.lockVersion });
      notify({ title: 'Ligne ignorée', description: paired ? 'La paire de lignes est sortie du pointage.' : 'Elle est sortie du pointage.' });
      onClose();
    } catch (error) {
      setFailure(error);
    }
  });

  const options = (candidates.data?.items ?? []).filter((item) => item.id !== line.id).map((item) => ({ value: item.id, label: `${formatDateFr(item.bookingDate)} · ${item.label} · ${moneyText(item.signedAmount, { signed: true })}` }));

  return (
    <form noValidate className="flex flex-col gap-3 p-4" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
      <p className="text-body text-fg-muted">{`${formatDateFr(line.bookingDate)} · ${moneyText(line.signedAmount, { signed: true })}`}</p>
      <FormSelect control={form.control} name="reason" label="Motif *" placeholder="Choisissez le motif" options={IGNORE_REASONS.map((value) => ({ value, label: ignoreReasonLabel[value] }))} />
      {paired ? (
        <>
          <p className="text-caption text-fg-subtle">Sur un compte de tiers, les lignes s’ignorent par paire : choisissez l’opération opposée de même montant.</p>
          <FormSelect control={form.control} name="pairLineId" label="Opération opposée *" placeholder="Choisissez l’opération" options={options} searchable emptyLabel="Aucune opération opposée de même montant" />
        </>
      ) : null}
      {failure === null ? null : <ActionError title="Ligne non ignorée" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={form.formState.isSubmitting}>Ignorer la ligne</Button>
      </div>
    </form>
  );
}
