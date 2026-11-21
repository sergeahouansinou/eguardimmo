'use client';

import { useState } from 'react';
import { Alert, Button, Dialog, DialogClose, DialogContent, TextField } from '@eguardimmo/ui';
import { localValueToIso } from '../../lib/dates';
import { scheduleIssue } from '../inputs';
import { MIN_SCHEDULE_MINUTES } from '../model';

export interface ScheduleDialogProps {
  open: boolean;
  loading: boolean;
  failure: string | null;
  now: () => Date;
  onClose: () => void;
  onSubmit: (scheduledAt: string) => void;
}

export function ScheduleDialog({ open, loading, failure, now, onClose, onSubmit }: ScheduleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        title="Programmer l’envoi"
        description={`Choisissez la date et l’heure (heure de Paris), ${String(MIN_SCHEDULE_MINUTES)} minutes au moins à partir de maintenant. Une campagne programmée peut être annulée tant qu’elle n’est pas partie.`}
        className="max-w-[480px]"
      >
        {open ? <ScheduleForm loading={loading} failure={failure} now={now} onSubmit={onSubmit} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ScheduleForm({ loading, failure, now, onSubmit }: Pick<ScheduleDialogProps, 'loading' | 'failure' | 'now' | 'onSubmit'>) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    if (value === '') {
      setError('Choisissez la date et l’heure d’envoi');
      return;
    }
    const iso = localValueToIso(value);
    const issue = scheduleIssue(iso, now());
    if (issue !== null) {
      setError(issue);
      return;
    }
    setError(undefined);
    onSubmit(iso);
  };

  return (
    <form
      noValidate
      aria-label="Programmer l’envoi"
      className="flex flex-col gap-3 px-4 pt-3 pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        submit();
      }}
    >
      <TextField
        data-autofocus
        label="Date et heure d’envoi"
        type="datetime-local"
        placeholder="jj/mm/aaaa hh:mm"
        value={value}
        onChange={(event) => { setValue(event.target.value); setError(undefined); }}
        {...(error ? { error } : {})}
      />
      {failure ? <Alert tone="danger" title="Programmation impossible">{failure}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Annuler</Button>
        </DialogClose>
        <Button type="submit" loading={loading}>Programmer</Button>
      </div>
    </form>
  );
}
