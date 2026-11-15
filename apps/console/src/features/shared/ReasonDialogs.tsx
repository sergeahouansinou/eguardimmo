'use client';

import { TextField, Textarea } from '@eguardimmo/ui';
import { errorMessage } from '@/console/hooks/core';
import { accessRequestInputSchema, suspendInputSchema } from '@/console/schemas';
import type { AccessRequestInput, SuspendInput } from '@/console/schemas';
import { useZodForm } from '@/lib/useZodForm';
import { FormDialog } from '@/ui/FormDialog';
import { useState } from 'react';
import type { ReactNode } from 'react';

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  submitLabel: string;
}

type SuspendProps = BaseProps & {
  onSubmit: (input: SuspendInput) => Promise<void>;
  tone?: 'primary' | 'danger';
  reasonLabel?: string;
  reasonPlaceholder?: string;
};

export function SuspendDialog(props: SuspendProps) {
  return props.open ? <SuspendForm {...props} /> : null;
}

function SuspendForm({
  onSubmit,
  tone = 'danger',
  reasonLabel = 'Motif',
  reasonPlaceholder = 'Impayé de plus de 60 jours, demande de l’organisation, fraude suspectée',
  ...base
}: SuspendProps) {
  const form = useZodForm(suspendInputSchema, { reason: '' });
  const [failure, setFailure] = useState<string | null>(null);
  const { register, handleSubmit, formState } = form;
  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await onSubmit(values);
      base.onOpenChange(false);
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });
  return (
    <FormDialog {...base} tone={tone} pending={formState.isSubmitting} failure={failure} onSubmit={(event) => void submit(event)}>
      <Textarea
        label={reasonLabel}
        placeholder={reasonPlaceholder}
        rows={3}
        error={formState.errors.reason?.message}
        {...register('reason')}
      />
    </FormDialog>
  );
}

type AccessRequestProps = BaseProps & { onSubmit: (input: AccessRequestInput) => Promise<void> };

export function AccessRequestDialog(props: AccessRequestProps) {
  return props.open ? <AccessRequestForm {...props} /> : null;
}

function AccessRequestForm({ onSubmit, ...base }: AccessRequestProps) {
  const form = useZodForm(accessRequestInputSchema, { reason: '', ticket: '' });
  const [failure, setFailure] = useState<string | null>(null);
  const { register, handleSubmit, formState } = form;
  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await onSubmit(values);
      base.onOpenChange(false);
    } catch (error) {
      setFailure(errorMessage(error));
    }
  });
  return (
    <FormDialog {...base} pending={formState.isSubmitting} failure={failure} onSubmit={(event) => void submit(event)}>
      <Textarea
        label="Motif de l’accès"
        placeholder="Ticket SUP-2077 : vérification d’une quittance contestée"
        rows={3}
        error={formState.errors.reason?.message}
        {...register('reason')}
      />
      <TextField
        label="Référence du ticket"
        placeholder="SUP-2077"
        hint="Facultatif. Format SUP- suivi de 3 à 6 chiffres."
        error={formState.errors.ticket?.message}
        {...register('ticket')}
      />
    </FormDialog>
  );
}
