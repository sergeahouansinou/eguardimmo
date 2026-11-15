'use client';

import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { z } from 'zod';
import { Button, Dialog, DialogClose, DialogContent, Select, TextField, Textarea } from '@eguardimmo/ui';
import { pushFlash } from '../kit';
import { FREQUENCIES, emailFormSchema, frequencySchema, scheduleFormSchema } from './schemas';
import type { Frequency } from './schemas';
import { useAddSchedule, useSendEmail } from './source';

export interface ReportRef {
  slug: string;
  label: string;
}

const RECIPIENT = { label: 'Destinataire', placeholder: 'Ex. nom@exemple.com' } as const;

function Actions({ pending, submitLabel }: { pending: boolean; submitLabel: string }) {
  return (
    <div className="flex justify-end gap-2">
      <DialogClose asChild>
        <Button variant="secondary">Annuler</Button>
      </DialogClose>
      <Button type="submit" loading={pending}>
        {submitLabel}
      </Button>
    </div>
  );
}

function ScheduleForm({ report, onDone }: { report: ReportRef; onDone: () => void }) {
  const [recipient, setRecipient] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [errors, setErrors] = useState<{ recipient?: string }>({});
  const mutation = useAddSchedule();

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const parsed = scheduleFormSchema.safeParse({ recipient, frequency });
    if (!parsed.success) {
      setErrors({ recipient: z.flattenError(parsed.error).fieldErrors.recipient?.[0] });
      return;
    }
    setErrors({});
    mutation.mutate(
      { ...parsed.data, slug: report.slug, label: report.label },
      {
        onSuccess: () => {
          pushFlash(`Envoi programmé : ${report.label} à ${parsed.data.recipient}.`);
          onDone();
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 p-4">
      <TextField
        {...RECIPIENT}
        type="email"
        inputMode="email"
        value={recipient}
        error={errors.recipient}
        onChange={(event) => { setRecipient(event.target.value); }}
      />
      <Select
        label="Fréquence"
        placeholder="Choisir une fréquence"
        options={FREQUENCIES}
        value={frequency}
        onValueChange={(value) => { setFrequency(frequencySchema.parse(value)); }}
      />
      {mutation.isError ? <p className="text-caption text-fg-danger">L’envoi n’a pas pu être programmé. Réessayez.</p> : null}
      <Actions pending={mutation.isPending} submitLabel="Programmer l’envoi" />
    </form>
  );
}

export function ScheduleDialog({ open, onOpenChange, report }: { open: boolean; onOpenChange: (open: boolean) => void; report: ReportRef }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Programmer l’envoi" description={`${report.label}, envoyé automatiquement par e-mail.`} className="max-w-md">
        <ScheduleForm report={report} onDone={() => { onOpenChange(false); }} />
      </DialogContent>
    </Dialog>
  );
}

function EmailForm({ subject: initialSubject, onDone }: { subject: string; onDone: () => void }) {
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ recipient?: string; subject?: string; message?: string }>({});
  const mutation = useSendEmail();

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const parsed = emailFormSchema.safeParse({ recipient, subject, message });
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors;
      setErrors({ recipient: flat.recipient?.[0], subject: flat.subject?.[0], message: flat.message?.[0] });
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data, {
      onSuccess: () => {
        pushFlash(`Rapport envoyé à ${parsed.data.recipient} (démonstration, aucun e-mail réel).`);
        onDone();
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 p-4">
      <TextField
        {...RECIPIENT}
        type="email"
        inputMode="email"
        value={recipient}
        error={errors.recipient}
        onChange={(event) => { setRecipient(event.target.value); }}
      />
      <TextField
        label="Objet"
        placeholder="Ex. Loyers encaissés 2026"
        value={subject}
        error={errors.subject}
        onChange={(event) => { setSubject(event.target.value); }}
      />
      <Textarea
        label="Message"
        placeholder="Ex. Bonjour, veuillez trouver ci-joint le rapport."
        rows={3}
        value={message}
        error={errors.message}
        onChange={(event) => { setMessage(event.target.value); }}
      />
      {mutation.isError ? <p className="text-caption text-fg-danger">Le rapport n’a pas pu être envoyé. Réessayez.</p> : null}
      <Actions pending={mutation.isPending} submitLabel="Envoyer" />
    </form>
  );
}

export function EmailDialog({ open, onOpenChange, subject }: { open: boolean; onOpenChange: (open: boolean) => void; subject: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Envoyer par e-mail" description="Le PDF du rapport est joint au message." className="max-w-md">
        <EmailForm subject={subject} onDone={() => { onOpenChange(false); }} />
      </DialogContent>
    </Dialog>
  );
}
