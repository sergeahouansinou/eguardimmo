'use client';

import { Button, Dialog, DialogClose, DialogContent, Textarea } from '@eguardimmo/ui';
import { useState } from 'react';
import { useNotify } from '../../locataires/kit';
import { FormSelect, useTenantRequestsForm } from '../shared/form';
import { ActionError } from '../shared/parts/ActionError';
import { useRejectInsurance } from './hooks';
import { MAX_NOTE_LENGTH, REJECTION_REASONS, rejectionReasonLabel } from './model';
import type { InsuranceSubmission } from './model';
import { rejectSchema } from './schemas';
import type { RejectInput, RejectValues } from './schemas';

export function RejectDialog({ submission, tenant, onClose }: { submission: InsuranceSubmission | null; tenant: string; onClose: () => void }) {
  return (
    <Dialog open={submission !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        title={`Refuser l’attestation de ${tenant}`}
        description="Le motif est communiqué au locataire, qui pourra déposer une nouvelle attestation. Un dépôt refusé ne devient jamais une pièce de conformité."
        className="max-w-[520px]"
      >
        {submission === null ? null : <RejectForm submission={submission} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function RejectForm({ submission, onDone }: { submission: InsuranceSubmission; onDone: () => void }) {
  const reject = useRejectInsurance();
  const notify = useNotify();
  const [failure, setFailure] = useState<unknown>(null);
  const form = useTenantRequestsForm<RejectValues, RejectInput>(rejectSchema, { reason: undefined, note: '' });
  const length = form.watch('note').length;

  const submit = form.handleSubmit(async ({ reason, note }) => {
    setFailure(null);
    try {
      await reject.mutateAsync({ id: submission.id, reason, note: note === '' ? null : note });
      notify({ title: 'Attestation refusée', description: 'Le locataire est prévenu du motif.' });
      onDone();
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <form noValidate className="flex flex-col gap-3 p-4" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
      <FormSelect
        control={form.control}
        name="reason"
        label="Motif du refus *"
        placeholder="Choisir un motif, ex. Document illisible"
        options={REJECTION_REASONS.map((value) => ({ value, label: rejectionReasonLabel[value] }))}
      />
      <Textarea
        label="Note pour le locataire"
        placeholder="Ex. La page 2 de l’attestation est coupée, merci de la rescanner."
        rows={3}
        hint={`${String(length)} / ${String(MAX_NOTE_LENGTH)} caractères`}
        error={form.formState.errors.note?.message}
        {...form.register('note')}
      />
      {failure === null ? null : <ActionError title="Attestation non refusée" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" variant="danger" loading={form.formState.isSubmitting}>Refuser l’attestation</Button>
      </div>
    </form>
  );
}
