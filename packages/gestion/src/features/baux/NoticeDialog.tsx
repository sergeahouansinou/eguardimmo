'use client';

import { Button, Dialog, DialogClose, DialogContent, Textarea, TextField } from '@eguardimmo/ui';
import { useRecordNotice } from './hooks';
import { noticeInputSchema } from './schemas';
import type { Lease, LeaseExit } from './schemas';
import { errorMessage, useNotify } from '../locataires/kit';
import { addMonths, todayIso } from '../locataires/kit/dates';
import { useZodForm } from '../locataires/kit/useZodForm';

export function NoticeDialog({
  lease,
  exit,
  open,
  onOpenChange,
}: {
  lease: Lease;
  exit: LeaseExit | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const received = exit?.noticeReceivedOn ?? todayIso();
  const initial = {
    noticeReceivedOn: received,
    departure: exit?.departure ?? addMonths(received, lease.furnished ? 1 : 3),
    reason: exit?.reason ?? '',
  };
  const form = useZodForm(noticeInputSchema, initial);
  const record = useRecordNotice(lease.id);
  const notify = useNotify();

  const submit = async () => {
    const values = form.submit();
    if (!values) return;
    try {
      await record.mutateAsync(values);
      notify({ title: exit ? 'Préavis modifié' : 'Préavis enregistré', description: `Départ prévu le ${values.departure.split('-').reverse().join('/')}.` });
      onOpenChange(false);
    } catch (error) {
      notify({ tone: 'danger', title: 'Enregistrement impossible', description: errorMessage(error) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={exit ? 'Modifier le préavis' : 'Enregistrer un préavis'}
        description={lease.furnished ? 'Préavis d’un mois pour une location meublée.' : 'Préavis de trois mois pour une location vide, réduit dans certaines zones.'}
      >
        <form noValidate className="flex flex-col gap-3 p-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="Préavis reçu le *"
              type="date"
              placeholder="jj/mm/aaaa"
              value={form.values.noticeReceivedOn}
              error={form.error('noticeReceivedOn')}
              data-autofocus
              onChange={(event) => { form.setValue('noticeReceivedOn', event.target.value); }}
              onBlur={() => { form.touch('noticeReceivedOn'); }}
            />
            <TextField
              label="Départ le *"
              type="date"
              placeholder="jj/mm/aaaa"
              value={form.values.departure}
              error={form.error('departure')}
              onChange={(event) => { form.setValue('departure', event.target.value); }}
              onBlur={() => { form.touch('departure'); }}
            />
          </div>
          <Textarea
            label="Motif"
            placeholder="Ex. Mutation professionnelle"
            value={form.values.reason}
            onChange={(event) => { form.setValue('reason', event.target.value); }}
          />
          <div className="flex justify-end gap-2 pt-1">
            <DialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </DialogClose>
            <Button type="submit" loading={record.isPending}>Enregistrer le préavis</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
