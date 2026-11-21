'use client';

import { Button, Dialog, DialogClose, DialogContent, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { saveBlob } from '../rent/download';
import { useExportExpenses } from './hooks';
import { ActionError } from './parts/ActionError';
import { useChargesForm } from './parts/form';
import { FormSelect } from './parts/form';
import { usePropertyLabels } from './parts/choices';
import { exportSchema } from './schemas';
import type { ExportValues } from './schemas';
import { todayIso } from '../../locataires/kit/dates';

export function ExportExpensesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Exporter les dépenses" description="Fichier CSV des dépenses d’une période, au format du grand livre de l’organisation." className="max-w-[480px]">
        {open ? <ExportForm onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ExportForm({ onClose }: { onClose: () => void }) {
  const today = todayIso();
  const form = useChargesForm<ExportValues, { from: string; to: string; propertyId: string }>(exportSchema, { from: `${today.slice(0, 4)}-01-01`, to: today, propertyId: '' });
  const exporter = useExportExpenses();
  const properties = usePropertyLabels();
  const [failure, setFailure] = useState<unknown>(null);

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      const blob = await exporter.mutateAsync({ from: values.from, to: values.to, propertyId: values.propertyId === '' ? null : values.propertyId });
      saveBlob(blob, `depenses-${values.from}-${values.to}.csv`);
      onClose();
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <form noValidate className="flex flex-col gap-3 p-4" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Du *" type="date" placeholder="AAAA-MM-JJ" error={form.formState.errors.from?.message} {...form.register('from')} />
        <TextField label="Au (exclu) *" type="date" placeholder="AAAA-MM-JJ" error={form.formState.errors.to?.message} {...form.register('to')} />
      </div>
      <FormSelect control={form.control} name="propertyId" label="Bien" placeholder="Tous les biens" options={[{ value: '', label: 'Tous les biens' }, ...properties.options]} />
      {failure === null ? null : <ActionError title="Export impossible" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={exporter.isPending}>Exporter en CSV</Button>
      </div>
    </form>
  );
}
