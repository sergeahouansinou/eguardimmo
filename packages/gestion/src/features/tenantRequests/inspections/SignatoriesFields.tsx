'use client';

import { Button, Icon, IconButton, TextField } from '@eguardimmo/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { todayIso } from '../../locataires/kit/dates';
import { MAX_SIGNATORIES } from './model';
import type { InspectionFormValues } from './schemas';

type Form = UseFormReturn<InspectionFormValues, undefined, InspectionFormValues>;

export function SignatoriesFields({ form }: { form: Form }) {
  const rows = useFieldArray({ control: form.control, name: 'signatories' });
  const errors = form.formState.errors.signatories;
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="text-caption text-fg-muted">Signataires déclarés</legend>
      {rows.fields.length === 0 ? <p className="text-caption text-fg-subtle">Aucun signataire déclaré pour le moment.</p> : null}
      {rows.fields.map((row, index) => (
        <div key={row.id} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto]">
          <TextField label={`Nom du signataire ${String(index + 1)}`} placeholder="Ex. : Awa Diallo" error={errors?.[index]?.name?.message} {...form.register(`signatories.${String(index)}.name` as `signatories.${number}.name`)} />
          <TextField label={`Qualité du signataire ${String(index + 1)}`} placeholder="Ex. : Locataire" error={errors?.[index]?.capacity?.message} {...form.register(`signatories.${String(index)}.capacity` as `signatories.${number}.capacity`)} />
          <TextField label={`Date de signature ${String(index + 1)}`} type="date" placeholder="AAAA-MM-JJ" error={errors?.[index]?.date?.message} {...form.register(`signatories.${String(index)}.date` as `signatories.${number}.date`)} />
          <IconButton label={`Retirer le signataire ${String(index + 1)}`} icon={Trash2} variant="danger" onClick={() => { rows.remove(index); }} />
        </div>
      ))}
      {errors?.message ?? errors?.root?.message ? <span role="alert" className="text-caption text-fg-danger">{errors.message ?? errors.root?.message}</span> : null}
      <div>
        <Button variant="secondary" size="sm" disabled={rows.fields.length >= MAX_SIGNATORIES} onClick={() => { rows.append({ name: '', capacity: '', date: todayIso() }); }}>
          <Icon icon={Plus} />
          Ajouter un signataire
        </Button>
      </div>
    </fieldset>
  );
}
