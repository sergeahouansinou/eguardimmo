'use client';

import { Alert, Button, Dialog, DialogClose, DialogContent, Select, Textarea, TextField } from '@eguardimmo/ui';
import { useAddAct } from './hooks';
import { actLabel } from './labels';
import { MANUAL_ACT_TYPES } from './model';
import { actFormSchema } from './schemas';
import { errorMessage, useNotify } from '../../locataires/kit';
import { useZodForm } from '../../locataires/kit/useZodForm';
import { todayIso } from '../../locataires/kit/dates';

const typeOptions = MANUAL_ACT_TYPES.map((type) => ({ value: type, label: actLabel[type] }));

export function ActDialog({ caseId, open, onClose }: { caseId: string; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Ajouter une diligence" description="L’acte est ajouté au carnet du dossier, daté du jour où il a eu lieu." className="max-w-[520px]">
        {open ? <ActForm caseId={caseId} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ActForm({ caseId, onClose }: { caseId: string; onClose: () => void }) {
  const notify = useNotify();
  const add = useAddAct();
  const today = todayIso();
  const form = useZodForm(actFormSchema, { type: 'reminder', performedOn: today, note: '', reference: '' });
  const failure = add.error ? errorMessage(add.error) : null;

  const submit = () => {
    const values = form.submit();
    if (values === null) return;
    add.mutate(
      { caseId, input: values },
      {
        onSuccess: () => {
          notify({ title: 'Diligence ajoutée', description: `${actLabel[values.type]} inscrit au carnet.` });
          onClose();
        },
      },
    );
  };

  return (
    <form noValidate className="flex flex-col gap-3 p-4" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); submit(); }}>
      {failure ? <Alert tone="danger" title="Ajout impossible">{failure}</Alert> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select label="Type d’acte" placeholder="Choisir un type" options={typeOptions} value={form.values.type} error={form.error('type')} onValueChange={(value) => { form.setValue('type', value); }} />
        <TextField label="Date de l’acte" type="date" placeholder="AAAA-MM-JJ" max={today} value={form.values.performedOn} error={form.error('performedOn')} onChange={(event) => { form.setValue('performedOn', event.target.value); }} onBlur={() => { form.touch('performedOn'); }} />
      </div>
      <TextField label="Référence (facultatif)" placeholder="LRAR 1A234" value={form.values.reference} error={form.error('reference')} onChange={(event) => { form.setValue('reference', event.target.value); }} onBlur={() => { form.touch('reference'); }} />
      <Textarea label="Note (facultatif)" placeholder="Le locataire promet un virement avant le 20" rows={3} value={form.values.note} error={form.error('note')} onChange={(event) => { form.setValue('note', event.target.value); }} onBlur={() => { form.touch('note'); }} />
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Annuler</Button>
        </DialogClose>
        <Button type="submit" loading={add.isPending}>Ajouter au carnet</Button>
      </div>
    </form>
  );
}
