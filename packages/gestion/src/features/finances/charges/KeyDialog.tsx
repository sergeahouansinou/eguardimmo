'use client';

import { Button, Dialog, DialogClose, DialogContent, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { useFieldArray } from 'react-hook-form';
import { useAddKeyVersion, useCreateKey } from './hooks';
import { keyKindHint, keyKindLabel } from './labels';
import { KEY_KINDS } from './model';
import type { KeyKind, KeyShare, UnitChoice } from './model';
import { ActionError } from './parts/ActionError';
import { FormSelect, useChargesForm } from './parts/form';
import { weightPath } from './parts/paths';
import { keyFormSchema } from './schemas';
import type { KeyFormValues } from './schemas';
import { useNotify } from '../../locataires/kit';
import { todayIso } from '../../locataires/kit/dates';

export type KeyDialogTarget = { mode: 'create' } | { mode: 'version'; keyId: string; label: string; kind: KeyKind };

const WEIGHTED: readonly KeyKind[] = ['tantiemes', 'custom'];

export function KeyDialog({ target, propertyId, units, onClose }: { target: KeyDialogTarget | null; propertyId: string; units: readonly UnitChoice[]; onClose: () => void }) {
  return (
    <Dialog open={target !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        title={target?.mode === 'version' ? `Nouvelle version de « ${target.label} »` : 'Nouvelle clé de répartition'}
        description="Une clé est versionnée : une nouvelle version prend effet à sa date, l’historique reste intact."
        className="max-w-[560px]"
      >
        {target ? <KeyForm target={target} propertyId={propertyId} units={units} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function toShares(kind: KeyKind, weights: KeyFormValues['weights']): KeyShare[] {
  if (!WEIGHTED.includes(kind)) return [];
  return weights.flatMap((row) => (row.weight.trim() === '' ? [] : [{ unitId: row.unitId, weight: Number(row.weight) }]));
}

function KeyForm({ target, propertyId, units, onClose }: { target: KeyDialogTarget; propertyId: string; units: readonly UnitChoice[]; onClose: () => void }) {
  const create = useCreateKey();
  const addVersion = useAddKeyVersion();
  const notify = useNotify();
  const [failure, setFailure] = useState<unknown>(null);
  const form = useChargesForm<KeyFormValues, KeyFormValues>(keyFormSchema, {
    label: target.mode === 'version' ? target.label : '',
    kind: target.mode === 'version' ? target.kind : 'tantiemes',
    validFrom: todayIso(),
    weights: units.map((unit) => ({ unitId: unit.id, weight: '' })),
  });
  const weights = useFieldArray({ control: form.control, name: 'weights' });
  const kind = form.watch('kind');
  const weightsError = form.formState.errors.weights?.root?.message ?? form.formState.errors.weights?.message;

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    const shares = toShares(values.kind, values.weights);
    try {
      if (target.mode === 'version') await addVersion.mutateAsync({ propertyId, keyId: target.keyId, validFrom: values.validFrom, shares });
      else await create.mutateAsync({ propertyId, input: { label: values.label, kind: values.kind, validFrom: values.validFrom, shares } });
      notify({ title: target.mode === 'version' ? 'Version ajoutée' : 'Clé créée', description: 'Elle est utilisable dans les postes de charges.' });
      onClose();
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <form noValidate className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-4" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
      {target.mode === 'create' ? (
        <>
          <TextField label="Libellé *" placeholder="ex. Tantièmes généraux" error={form.formState.errors.label?.message} {...form.register('label')} data-autofocus />
          <FormSelect control={form.control} name="kind" label="Type de clé *" placeholder="Choisissez le type" options={KEY_KINDS.map((value) => ({ value, label: keyKindLabel[value], description: keyKindHint[value] }))} />
        </>
      ) : (
        <p className="text-caption text-fg-subtle">{`Type : ${keyKindLabel[target.kind]}. ${keyKindHint[target.kind]}`}</p>
      )}
      <TextField label="Date d’effet *" type="date" placeholder="AAAA-MM-JJ" error={form.formState.errors.validFrom?.message} {...form.register('validFrom')} />
      {WEIGHTED.includes(kind) ? (
        <fieldset className="flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-caption text-fg-muted">Poids par lot *</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {weights.fields.map((field, index) => (
              <TextField key={field.id} label={units.find((unit) => unit.id === field.unitId)?.reference ?? 'Lot'} inputMode="numeric" placeholder="ex. 120" error={form.formState.errors.weights?.[index]?.weight?.message} {...form.register(weightPath(index))} />
            ))}
          </div>
          {weightsError === undefined ? null : <span role="alert" className="text-caption text-fg-danger">{weightsError}</span>}
          {units.length === 0 ? <span className="text-caption text-fg-subtle">Ce bien n’a aucun lot : ajoutez-en avant de créer une clé pondérée.</span> : null}
        </fieldset>
      ) : null}
      {failure === null ? null : <ActionError title="Clé non enregistrée" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={form.formState.isSubmitting}>{target.mode === 'version' ? 'Ajouter la version' : 'Créer la clé'}</Button>
      </div>
    </form>
  );
}
