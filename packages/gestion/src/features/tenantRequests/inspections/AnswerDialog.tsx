'use client';

import { Button, Dialog, DialogClose, DialogContent, Textarea } from '@eguardimmo/ui';
import { useState } from 'react';
import { useNotify } from '../../locataires/kit';
import { FormSelect, useTenantRequestsForm } from '../shared/form';
import { ActionError } from '../shared/parts/ActionError';
import { useAnswerRemark } from './hooks';
import { REMARK_ANSWERS, answerLabel } from './model';
import type { Remark } from './model';
import { answerSchema } from './schemas';
import type { AnswerValues } from './schemas';

export function AnswerDialog({ remark, open, onClose }: { remark: Remark; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        title="Répondre à la remarque du locataire"
        description="Une remarque ne reçoit qu’une réponse. Elle reste une trace : elle ne modifie pas le PDF de l’état des lieux."
        className="max-w-[520px]"
      >
        {open ? <AnswerForm remark={remark} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AnswerForm({ remark, onDone }: { remark: Remark; onDone: () => void }) {
  const answer = useAnswerRemark();
  const notify = useNotify();
  const [failure, setFailure] = useState<unknown>(null);
  const form = useTenantRequestsForm<AnswerValues, AnswerValues>(answerSchema, { answer: 'noted', body: '' });

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await answer.mutateAsync({ remarkId: remark.id, answer: values.answer, body: values.body.trim() });
      notify({ title: 'Réponse envoyée', description: 'Le locataire en est informé.' });
      onDone();
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <form noValidate className="flex flex-col gap-3 p-4" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
      <FormSelect control={form.control} name="answer" label="Décision *" placeholder="Choisir une décision" options={REMARK_ANSWERS.map((value) => ({ value, label: answerLabel[value] }))} />
      <Textarea label="Réponse *" placeholder="Ex. : Les traces sur le mur du salon seront ajoutées à l’état d’entrée." rows={4} error={form.formState.errors.body?.message} {...form.register('body')} />
      {failure === null ? null : <ActionError title="Réponse non envoyée" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={form.formState.isSubmitting}>Envoyer la réponse</Button>
      </div>
    </form>
  );
}
