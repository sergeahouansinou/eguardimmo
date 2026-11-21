'use client';

import { Button, Dialog, DialogClose, DialogContent, Textarea } from '@eguardimmo/ui';
import { useState } from 'react';
import { useRecordPlan } from './hooks';
import { planBasisLabel } from './labels';
import { PLAN_BASES } from './model';
import { ActionError } from './parts/ActionError';
import { FormSelect, useChargesForm } from './parts/form';
import { planSchema } from './schemas';
import type { PlanValues } from './schemas';
import { useAttemptKey } from '../ownerfunds/attemptKey';
import { useNotify } from '../../locataires/kit';

export function PlanDialog({ statementId, open, onClose }: { statementId: string; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Étaler le solde sur douze mensualités" description="Le solde dû est réparti sur douze avis d’échéance. Le motif est conservé avec le décompte." className="max-w-[520px]">
        {open ? <PlanForm statementId={statementId} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PlanForm({ statementId, onClose }: { statementId: string; onClose: () => void }) {
  const record = useRecordPlan();
  const attemptKey = useAttemptKey();
  const notify = useNotify();
  const [failure, setFailure] = useState<unknown>(null);
  const form = useChargesForm<PlanValues, { reason: string; basis: PlanValues['basis'] }>(planSchema, { reason: '', basis: 'late_statement' });

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await record.mutateAsync({ id: statementId, input: values, key: attemptKey(`${statementId}:${values.basis}:${values.reason}`) });
      notify({ title: 'Échéancier enregistré', description: 'Le solde sera repris sur douze avis d’échéance.' });
      onClose();
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <form noValidate className="flex flex-col gap-3 p-4" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
      <FormSelect control={form.control} name="basis" label="Fondement *" placeholder="Choisissez le fondement" options={PLAN_BASES.map((value) => ({ value, label: planBasisLabel[value] }))} />
      <Textarea label="Motif *" placeholder="ex. Demande du locataire du 12 mars" rows={3} error={form.formState.errors.reason?.message} {...form.register('reason')} data-autofocus />
      {failure === null ? null : <ActionError title="Échéancier non enregistré" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={form.formState.isSubmitting}>Enregistrer l’échéancier</Button>
      </div>
    </form>
  );
}
