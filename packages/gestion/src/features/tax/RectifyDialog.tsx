'use client';

import { Button, Dialog, DialogClose, DialogContent, Textarea } from '@eguardimmo/ui';
import { useState } from 'react';
import { z } from 'zod';
import { useAttemptKey } from '../finances/ownerfunds/attemptKey';
import { useNotify } from '../locataires/kit';
import { ActionError } from '../orgapi/ActionError';
import { useOrgForm } from '../orgapi/form';
import type { TaxSummary } from './model';

const schema = z.object({ reason: z.string().trim().min(5, 'Le motif doit contenir au moins 5 caractères.').max(500, 'Le motif ne peut pas dépasser 500 caractères.') });
type Values = z.input<typeof schema>;

export interface RectifyDialogProps {
  open: boolean;
  summary: TaxSummary;
  run: (input: { reason: string; lockVersion: number }, key: string) => Promise<TaxSummary>;
  onDone: (created: TaxSummary) => void;
  onClose: () => void;
}

export function RectifyDialog({ open, summary, run, onDone, onClose }: RectifyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Rectifier cette synthèse" description="Une nouvelle version est calculée avec les données actuelles. L’ancienne reste consultable, marquée comme remplacée." className="max-w-[520px]">
        {open ? <RectifyForm summary={summary} run={run} onDone={onDone} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function RectifyForm({ summary, run, onDone }: Omit<RectifyDialogProps, 'open' | 'onClose'>) {
  const notify = useNotify();
  const keyFor = useAttemptKey();
  const form = useOrgForm<Values, Values>(schema, { reason: '' });
  const [failure, setFailure] = useState<unknown>(null);
  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      const created = await run({ reason: values.reason.trim(), lockVersion: summary.lockVersion }, keyFor(JSON.stringify([summary.id, summary.lockVersion, values.reason.trim()])));
      notify({ title: 'Rectification enregistrée' });
      onDone(created);
    } catch (error) {
      setFailure(error);
    }
  });
  return (
    <form noValidate className="flex flex-col gap-3 p-4" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
      <Textarea label="Motif de la rectification *" placeholder="Ex. facture de travaux ajoutée après la première synthèse" error={form.formState.errors.reason?.message} {...form.register('reason')} data-autofocus />
      {failure === null ? null : <ActionError title="Rectification impossible" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={form.formState.isSubmitting}>Rectifier</Button>
      </div>
    </form>
  );
}
