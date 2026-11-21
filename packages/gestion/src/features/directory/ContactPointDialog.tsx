'use client';

import { Button, Checkbox, Dialog, DialogClose, DialogContent, Select, TextField } from '@eguardimmo/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActionError } from '../orgapi/ActionError';
import { useNotify } from '../locataires/kit';
import { contactPointFormSchema } from './formSchema';
import type { ContactPointFormOutput, ContactPointFormValues } from './formSchema';
import { useAddContactPoint, useUpdateContactPoint } from './hooks';
import { pointTypeLabel } from './labels';
import { CONTACT_POINT_TYPES } from './model';
import type { ContactPoint, ContactPointChanges } from './model';

export interface ContactPointDialogProps {
  contactId: string;
  point: ContactPoint | null;
  open: boolean;
  onClose: () => void;
}

export function ContactPointDialog({ contactId, point, open, onClose }: ContactPointDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title={point ? 'Modifier la coordonnée' : 'Ajouter une coordonnée'} description="L’interlocuteur est la personne à joindre à ce numéro ou à cette adresse.">
        {open ? <ContactPointForm contactId={contactId} point={point} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function changesOf(point: ContactPoint, values: ContactPointFormOutput): ContactPointChanges {
  const label = values.label === '' ? null : values.label;
  return {
    ...(values.value === point.value ? {} : { value: values.value }),
    ...(label === point.label ? {} : { label }),
    ...(values.primary && !point.primary ? { primary: true as const } : {}),
  };
}

function ContactPointForm({ contactId, point, onClose }: { contactId: string; point: ContactPoint | null; onClose: () => void }) {
  const add = useAddContactPoint();
  const update = useUpdateContactPoint();
  const notify = useNotify();
  const [failure, setFailure] = useState<unknown>(null);
  const form = useForm<ContactPointFormValues, undefined, ContactPointFormOutput>({
    resolver: zodResolver(contactPointFormSchema),
    defaultValues: { type: point?.type ?? 'email', value: point?.value ?? '', label: point?.label ?? '', primary: point?.primary ?? false },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      if (point === null) {
        await add.mutateAsync({ id: contactId, input: { type: values.type, value: values.value, label: values.label === '' ? null : values.label, primary: values.primary } });
        notify({ title: 'Coordonnée ajoutée' });
      } else {
        const changes = changesOf(point, values);
        if (Object.keys(changes).length > 0) {
          await update.mutateAsync({ id: contactId, pointId: point.id, changes });
          notify({ title: 'Coordonnée modifiée' });
        }
      }
      onClose();
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <form noValidate className="flex flex-col gap-3 p-4" onSubmit={(event) => { void submit(event); }}>
      {point === null ? (
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => <Select label="Type" placeholder="Type" options={CONTACT_POINT_TYPES.map((value) => ({ value, label: pointTypeLabel[value] }))} value={field.value} onValueChange={field.onChange} />}
        />
      ) : null}
      <TextField label="Coordonnée *" placeholder="ex. contact@exemple.fr" autoComplete="off" error={form.formState.errors.value?.message} data-autofocus {...form.register('value')} />
      <TextField label="Interlocuteur" placeholder="ex. Rodrigue Sanvi" autoComplete="off" error={form.formState.errors.label?.message} {...form.register('label')} />
      {point?.primary ? null : <Checkbox label="Coordonnée principale de ce type" {...form.register('primary')} />}
      {failure === null ? null : <ActionError title="Coordonnée non enregistrée" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Annuler</Button>
        </DialogClose>
        <Button type="submit" loading={form.formState.isSubmitting}>Enregistrer</Button>
      </div>
    </form>
  );
}
