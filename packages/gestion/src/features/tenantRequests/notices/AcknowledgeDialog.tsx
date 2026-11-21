'use client';

import { Button, Dialog, DialogClose, DialogContent, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { useNotify } from '../../locataires/kit';
import { todayIso } from '../../locataires/kit/dates';
import { useTenantRequestsForm } from '../shared/form';
import { ActionError } from '../shared/parts/ActionError';
import { useAcknowledgeNotice } from './hooks';
import type { NoticeRequest } from './model';
import { acknowledgeSchema } from './schemas';
import type { AcknowledgeValues } from './schemas';

export function AcknowledgeDialog({ notice, open, onClose }: { notice: NoticeRequest; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        title="Accuser réception de la demande de congé"
        description="La date de réception que vous posez est celle de la remise. Elle fait courir le préavis et fixe le premier jour de départ possible."
        className="max-w-[480px]"
      >
        {open ? <AcknowledgeForm notice={notice} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AcknowledgeForm({ notice, onDone }: { notice: NoticeRequest; onDone: () => void }) {
  const acknowledge = useAcknowledgeNotice();
  const notify = useNotify();
  const [failure, setFailure] = useState<unknown>(null);
  const today = todayIso();
  const form = useTenantRequestsForm<AcknowledgeValues, AcknowledgeValues>(acknowledgeSchema, { receivedOn: today });

  const submit = form.handleSubmit(async ({ receivedOn }) => {
    setFailure(null);
    if (receivedOn > today) {
      form.setError('receivedOn', { message: 'La date de réception ne peut pas être dans le futur.' });
      return;
    }
    if (receivedOn < notice.createdAt.slice(0, 10)) {
      form.setError('receivedOn', { message: 'La date de réception ne peut pas précéder le dépôt de la demande.' });
      return;
    }
    try {
      await acknowledge.mutateAsync({ id: notice.id, receivedOn });
      notify({ title: 'Accusé de réception posé', description: 'Le locataire en est informé et le premier jour de départ possible est recalculé.' });
      onDone();
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-3 p-4"
      onSubmit={(event) => {
        event.stopPropagation();
        void submit(event);
      }}
    >
      <TextField label="Date de réception *" type="date" placeholder="AAAA-MM-JJ" max={today} hint={`Déposée le ${notice.createdAt.slice(0, 10).split('-').reverse().join('/')}.`} error={form.formState.errors.receivedOn?.message} {...form.register('receivedOn')} data-autofocus />
      {failure === null ? null : <ActionError title="Accusé non enregistré" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={form.formState.isSubmitting}>Accuser réception</Button>
      </div>
    </form>
  );
}
