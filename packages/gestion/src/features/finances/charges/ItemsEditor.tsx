'use client';

import { Alert, Button, Icon } from '@eguardimmo/ui';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFieldArray } from 'react-hook-form';
import { ItemFields } from './ItemFields';
import type { ItemChoices } from './ItemFields';
import { emptyItem, hasForeignSources, toFormItems, toItemInputs } from './itemsMapping';
import { useChargeKeys, useSourceExpenses, useUnitChoices, useUpdateExercise } from './hooks';
import type { ExerciseDetail } from './model';
import { ActionError } from './parts/ActionError';
import { useChargesForm } from './parts/form';
import { useRubricLabels } from './parts/choices';
import { itemsFormSchema } from './schemas';
import type { ItemsFormOutput, ItemsFormValues } from './schemas';
import { ListLoading, LoadError, useNotify } from '../../locataires/kit';
import type { Currency } from '../../../format/money';

export function ItemsEditor({ exercise, currency }: { exercise: ExerciseDetail; currency: Currency }) {
  const keys = useChargeKeys(exercise.propertyId);
  const units = useUnitChoices(exercise.propertyId);
  const expenses = useSourceExpenses(exercise.propertyId);
  const rubrics = useRubricLabels();

  if (hasForeignSources(exercise.items)) {
    return <Alert tone="info" title="Postes issus de factures fournisseurs">Cet exercice contient des postes alimentés par des factures fournisseurs : ils ne se modifient pas depuis cet écran.</Alert>;
  }
  if (keys.isPending || units.isPending || expenses.isPending || rubrics.query.isPending) return <ListLoading label="Chargement des postes" />;
  if (keys.data === undefined || units.data === undefined || expenses.data === undefined || rubrics.query.data === undefined) return <LoadError title="Impossible de préparer l’édition des postes" />;

  return <ItemsForm exercise={exercise} currency={currency} choices={{ keys: keys.data, units: units.data, expenses: expenses.data, rubrics: rubrics.options, currency }} />;
}

function ItemsForm({ exercise, currency, choices }: { exercise: ExerciseDetail; currency: Currency; choices: ItemChoices }) {
  const update = useUpdateExercise();
  const notify = useNotify();
  const [failure, setFailure] = useState<unknown>(null);
  const schema = useMemo(() => itemsFormSchema(currency), [currency]);
  const form = useChargesForm<ItemsFormValues, ItemsFormOutput>(schema, { items: toFormItems(exercise.items, currency, choices.units) });
  const items = useFieldArray({ control: form.control, name: 'items' });

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await update.mutateAsync({ id: exercise.id, lockVersion: exercise.lockVersion, items: toItemInputs(values, choices.keys) });
      notify({ title: 'Postes enregistrés', description: 'Relancez le calcul pour mettre à jour les décomptes.' });
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={(event) => { void submit(event); }}>
      {choices.keys.length === 0 && choices.units.length > 0 ? (
        <Alert tone="info" title="Aucune clé de répartition sur ce bien">Créez une clé dans « Clés de répartition », ou rattachez un poste directement à un lot.</Alert>
      ) : null}
      {items.fields.length === 0 ? <p className="text-body text-fg-subtle">Aucun poste. Ajoutez les charges à régulariser : chacune reprend une ou plusieurs dépenses enregistrées.</p> : null}
      <ul className="flex flex-col gap-3">
        {items.fields.map((field, index) => (
          <ItemFields key={field.id} control={form.control} register={form.register} errors={form.formState.errors} index={index} choices={choices} onRemove={() => { items.remove(index); }} />
        ))}
      </ul>
      {failure === null ? null : <ActionError title="Postes non enregistrés" error={failure} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" onClick={() => { items.append(emptyItem(choices.units)); }}>
          <Icon icon={Plus} />
          Ajouter un poste
        </Button>
        <Button type="submit" loading={form.formState.isSubmitting}>Enregistrer les postes</Button>
      </div>
    </form>
  );
}
