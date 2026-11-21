'use client';

import { RadioGroup, Select, TextField, useToast } from '@eguardimmo/ui';
import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { problemText } from '@/platform/errors';
import { RECORDABLE_CHANNELS, REQUEST_KINDS } from '@/platform/privacy/privacy';
import { FormDialog } from '@/ui/FormDialog';
import { useRecordRequest } from './hooks';
import { CHANNEL_LABELS, KIND_LABELS } from './labels';
import { validateRecordRequest } from './schemas';
import type { RecordRequestErrors, RecordRequestForm } from './schemas';

const EMPTY: RecordRequestForm = { kind: '', channel: '', requesterEmail: '', receivedOn: '' };

function Body({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { show } = useToast();
  const [form, setForm] = useState<RecordRequestForm>(EMPTY);
  const [errors, setErrors] = useState<RecordRequestErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const record = useRecordRequest();
  const set = (patch: Partial<RecordRequestForm>) => {
    setForm({ ...form, ...patch });
    setErrors({});
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFailure(null);
    const checked = validateRecordRequest(form);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    record.mutate(
      { kind: checked.data.kind, channel: checked.data.channel, requesterEmail: checked.data.requesterEmail, receivedOn: checked.data.receivedOn },
      {
        onSuccess: () => {
          show({ tone: 'success', title: 'Demande enregistrée', description: 'Le délai d’un mois court à partir de la date de réception.' });
          onOpenChange(false);
        },
        onError: (error) => { setFailure(problemText(error)); },
      },
    );
  };

  return (
    <FormDialogFields form={form} errors={errors} set={set} failure={failure} pending={record.isPending} onSubmit={submit} onOpenChange={onOpenChange} />
  );
}

interface FieldsProps {
  form: RecordRequestForm;
  errors: RecordRequestErrors;
  set: (patch: Partial<RecordRequestForm>) => void;
  failure: string | null;
  pending: boolean;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onOpenChange: (open: boolean) => void;
}

function FormDialogFields({ form, errors, set, failure, pending, onSubmit, onOpenChange }: FieldsProps) {
  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title="Enregistrer une demande reçue hors application"
      description="Pour une demande arrivée par e-mail ou par courrier. Les demandes faites depuis le compte sont créées automatiquement."
      submitLabel="Enregistrer la demande"
      pending={pending}
      failure={failure}
      onSubmit={onSubmit}
    >
      <Select
        label="Type de demande"
        placeholder="Choisir un type"
        options={REQUEST_KINDS.map((value) => ({ value, label: KIND_LABELS[value] ?? value }))}
        value={form.kind}
        error={errors.kind}
        onValueChange={(kind) => { set({ kind }); }}
      />
      <RadioGroup
        label="Canal de réception"
        options={RECORDABLE_CHANNELS.map((value) => ({ value, label: CHANNEL_LABELS[value] ?? value }))}
        value={form.channel}
        error={errors.channel}
        onValueChange={(channel) => { set({ channel }); }}
      />
      <TextField
        label="E-mail du demandeur"
        placeholder="claire.martin@exemple.fr"
        type="email"
        inputMode="email"
        autoComplete="off"
        value={form.requesterEmail}
        error={errors.requesterEmail}
        onChange={(event) => { set({ requesterEmail: event.target.value }); }}
        data-autofocus
      />
      <TextField
        label="Date de réception (facultatif)"
        placeholder="2026-11-18"
        type="date"
        value={form.receivedOn}
        error={errors.receivedOn}
        hint="Par défaut : aujourd’hui. Le délai de réponse part de cette date."
        onChange={(event) => { set({ receivedOn: event.target.value }); }}
      />
    </FormDialog>
  );
}

export function RecordRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return open ? <Body onOpenChange={onOpenChange} /> : null;
}
