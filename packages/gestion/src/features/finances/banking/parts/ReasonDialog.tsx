'use client';

import { Button, Dialog, DialogClose, DialogContent, Textarea } from '@eguardimmo/ui';
import { useState } from 'react';
import { reasonSchema } from '../schemas';
import type { ReasonValues } from '../schemas';
import { ActionError } from './ActionError';
import { useBankingForm } from './form';

export interface ReasonDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  failureTitle: string;
  placeholder: string;
  run: (reason: string) => Promise<void>;
  onClose: () => void;
}

export function ReasonDialog({ open, title, description, confirmLabel, failureTitle, placeholder, run, onClose }: ReasonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title={title} description={description} className="max-w-[480px]">
        {open ? <ReasonForm confirmLabel={confirmLabel} failureTitle={failureTitle} placeholder={placeholder} run={run} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ReasonForm({ confirmLabel, failureTitle, placeholder, run, onDone }: Pick<ReasonDialogProps, 'confirmLabel' | 'failureTitle' | 'placeholder' | 'run'> & { onDone: () => void }) {
  const form = useBankingForm<ReasonValues, { reason: string }>(reasonSchema, { reason: '' });
  const [failure, setFailure] = useState<unknown>(null);

  const submit = form.handleSubmit(async ({ reason }) => {
    setFailure(null);
    try {
      await run(reason);
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
      <Textarea label="Motif *" placeholder={placeholder} rows={3} error={form.formState.errors.reason?.message} {...form.register('reason')} data-autofocus />
      {failure === null ? null : <ActionError title={failureTitle} error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={form.formState.isSubmitting}>{confirmLabel}</Button>
      </div>
    </form>
  );
}
