'use client';

import { useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { Alert, Button, Dialog, DialogClose, DialogContent, Select, TextField } from '@eguardimmo/ui';
import { ASSIGNEES } from '../shared/biens';
import type { Assignee } from '../shared/biens';
import { isoDateSchema } from '../shared/schemas';
import { countLabel } from '../shared/ui';

interface TaskDialogProps {
  open: boolean;
  count: number;
  pending: boolean;
  error: string | null;
  onClose: () => void;
}

function Shell({ open, title, count, onClose, children }: Pick<TaskDialogProps, 'open' | 'count' | 'onClose'> & { title: string; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      {open ? (
        <DialogContent title={title} description={countLabel(count, 'tâche')} className="max-w-md">
          {children}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function Footer({ pending, label }: { pending: boolean; label: string }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <DialogClose asChild>
        <Button variant="secondary">Annuler</Button>
      </DialogClose>
      <Button type="submit" loading={pending}>{label}</Button>
    </div>
  );
}

export function PostponeDialog({ onSubmit, ...shell }: TaskDialogProps & { initialDate: string; onSubmit: (dueDate: string) => void }) {
  return (
    <Shell open={shell.open} count={shell.count} title="Reporter l’échéance" onClose={shell.onClose}>
      <PostponeForm key={shell.initialDate} initialDate={shell.initialDate} pending={shell.pending} error={shell.error} onSubmit={onSubmit} />
    </Shell>
  );
}

function PostponeForm({ initialDate, pending, error, onSubmit }: { initialDate: string; pending: boolean; error: string | null; onSubmit: (dueDate: string) => void }) {
  const [date, setDate] = useState(initialDate);
  const [problem, setProblem] = useState<string | undefined>();
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const parsed = isoDateSchema.safeParse(date);
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message);
      return;
    }
    setProblem(undefined);
    onSubmit(parsed.data);
  };
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3 p-4">
      {error ? <Alert tone="danger" title="Le report n’a pas abouti">{error}</Alert> : null}
      <TextField label="Nouvelle échéance *" type="date" placeholder="AAAA-MM-JJ" value={date} error={problem} onChange={(event) => { setDate(event.target.value); }} />
      <Footer pending={pending} label="Reporter" />
    </form>
  );
}

export function AssignTaskDialog({ onSubmit, ...shell }: TaskDialogProps & { onSubmit: (assignee: Assignee) => void }) {
  return (
    <Shell open={shell.open} count={shell.count} title="Assigner à" onClose={shell.onClose}>
      <AssignForm pending={shell.pending} error={shell.error} onSubmit={onSubmit} />
    </Shell>
  );
}

function AssignForm({ pending, error, onSubmit }: { pending: boolean; error: string | null; onSubmit: (assignee: Assignee) => void }) {
  const [value, setValue] = useState('');
  const [problem, setProblem] = useState<string | undefined>();
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const assignee = ASSIGNEES.find((name) => name === value);
    if (!assignee) {
      setProblem('Choisissez la personne assignée.');
      return;
    }
    setProblem(undefined);
    onSubmit(assignee);
  };
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3 p-4">
      {error ? <Alert tone="danger" title="L’assignation n’a pas abouti">{error}</Alert> : null}
      <Select
        label="Assigner à *"
        placeholder="Choisir une personne"
        options={ASSIGNEES.map((name) => ({ value: name, label: name }))}
        value={value}
        error={problem}
        onValueChange={setValue}
      />
      <Footer pending={pending} label="Assigner" />
    </form>
  );
}
