'use client';

import { Button, Dialog, DialogClose, DialogContent, Select, TextField } from '@eguardimmo/ui';
import type { SelectOption } from '@eguardimmo/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActionError } from '../../orgapi';
import { assignSchema, postponeSchema } from './schema';

interface DialogShellProps {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
}

function Shell({ open, title, description, onClose, children }: DialogShellProps & { children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title={title} description={description} className="max-w-[480px]">
        {open ? children : null}
      </DialogContent>
    </Dialog>
  );
}

function Footer({ label, loading }: { label: string; loading: boolean }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <DialogClose asChild>
        <Button type="button" variant="ghost">Retour</Button>
      </DialogClose>
      <Button type="submit" loading={loading}>{label}</Button>
    </div>
  );
}

export function PostponeDialog({ open, count, defaultDueOn, onClose, onConfirm }: Omit<DialogShellProps, 'title' | 'description'> & { count: number; defaultDueOn: string; onConfirm: (dueOn: string) => Promise<void> }) {
  const [failure, setFailure] = useState<unknown>(null);
  const form = useForm({ resolver: zodResolver(postponeSchema), defaultValues: { dueOn: defaultDueOn } });
  const submit = form.handleSubmit(async ({ dueOn }) => {
    setFailure(null);
    try {
      await onConfirm(dueOn);
    } catch (error) {
      setFailure(error);
    }
  });
  return (
    <Shell open={open} title="Reporter l’échéance" description={`${String(count)} tâche${count > 1 ? 's' : ''} ouverte${count > 1 ? 's' : ''} recevront la même nouvelle échéance.`} onClose={onClose}>
      <form noValidate className="flex flex-col gap-3 p-4" onSubmit={(event) => { void submit(event); }}>
        <TextField label="Nouvelle échéance *" type="date" placeholder="AAAA-MM-JJ" error={form.formState.errors.dueOn?.message} data-autofocus {...form.register('dueOn')} />
        {failure === null ? null : <ActionError title="Échéances non reportées" error={failure} />}
        <Footer label="Reporter" loading={form.formState.isSubmitting} />
      </form>
    </Shell>
  );
}

export function AssignDialog({ open, count, options, onClose, onConfirm }: Omit<DialogShellProps, 'title' | 'description'> & { count: number; options: readonly SelectOption[]; onConfirm: (assigneeUserId: string) => Promise<void> }) {
  const [failure, setFailure] = useState<unknown>(null);
  const form = useForm({ resolver: zodResolver(assignSchema), defaultValues: { assigneeUserId: '' } });
  const submit = form.handleSubmit(async ({ assigneeUserId }) => {
    setFailure(null);
    try {
      await onConfirm(assigneeUserId);
    } catch (error) {
      setFailure(error);
    }
  });
  return (
    <Shell open={open} title="Assigner à un membre" description={`${String(count)} tâche${count > 1 ? 's' : ''} sélectionnée${count > 1 ? 's' : ''}.`} onClose={onClose}>
      <form noValidate className="flex flex-col gap-3 p-4" onSubmit={(event) => { void submit(event); }}>
        <Controller
          control={form.control}
          name="assigneeUserId"
          render={({ field, fieldState }) => <Select label="Nouveau responsable *" placeholder="Choisissez un membre" options={options} value={field.value} onValueChange={field.onChange} error={fieldState.error?.message} searchable />}
        />
        {failure === null ? null : <ActionError title="Tâches non assignées" error={failure} />}
        <Footer label="Assigner" loading={form.formState.isSubmitting} />
      </form>
    </Shell>
  );
}
