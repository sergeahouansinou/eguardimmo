'use client';

import { Button, Card, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { useCreateExercise } from './hooks';
import { ChargesGate } from './parts/ChargesGate';
import { ActionError } from './parts/ActionError';
import { FormSelect, useChargesForm } from './parts/form';
import { usePropertyLabels } from './parts/choices';
import { chargesPaths } from './paths';
import { exerciseHeaderSchema } from './schemas';
import type { ExerciseHeaderValues } from './schemas';
import { LinkButton, PageHeader, noticeAfterNavigation, useGestionNavigation } from '../../locataires/kit';
import { links } from '../../locataires/kit/links';

export function ExerciseFormPage() {
  return (
    <ChargesGate>
      <ExerciseFormContent />
    </ChargesGate>
  );
}

function ExerciseFormContent() {
  const { push, search } = useGestionNavigation();
  const create = useCreateExercise();
  const properties = usePropertyLabels();
  const [failure, setFailure] = useState<unknown>(null);
  const year = new Date().getFullYear() - 1;
  const form = useChargesForm<ExerciseHeaderValues, ExerciseHeaderValues>(exerciseHeaderSchema, {
    propertyId: search.get('bien') ?? '',
    periodStart: `${String(year)}-01-01`,
    periodEnd: `${String(year + 1)}-01-01`,
  });

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      const exercise = await create.mutateAsync({ ...values, items: [] });
      noticeAfterNavigation({ title: 'Exercice créé', description: 'Ajoutez maintenant les postes de charges, puis lancez le calcul.' });
      push(chargesPaths.exercise(exercise.id));
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Régularisation des charges', href: chargesPaths.exercises }, { label: 'Nouvel exercice' }]}
        title="Nouvel exercice"
        subtitle="Choisissez l’immeuble et la période régularisée. Les postes de charges s’ajoutent à l’étape suivante."
      />
      <Card role="region" aria-label="Formulaire d’exercice" className="gap-4">
        <form noValidate className="flex flex-col gap-4" onSubmit={(event) => { void submit(event); }}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormSelect control={form.control} name="propertyId" label="Bien *" placeholder="Choisissez le bien" options={properties.options} searchable />
            <TextField label="Début *" type="date" placeholder="AAAA-MM-JJ" error={form.formState.errors.periodStart?.message} {...form.register('periodStart')} />
            <TextField label="Fin (exclue) *" type="date" placeholder="AAAA-MM-JJ" hint="Le lendemain du dernier jour, ex. 2027-01-01." error={form.formState.errors.periodEnd?.message} {...form.register('periodEnd')} />
          </div>
          {failure === null ? null : <ActionError title="Exercice non créé" error={failure} />}
          <div className="flex flex-wrap justify-end gap-2">
            <LinkButton href={chargesPaths.exercises} variant="ghost">Annuler</LinkButton>
            <Button type="submit" loading={form.formState.isSubmitting}>Créer l’exercice</Button>
          </div>
        </form>
      </Card>
    </>
  );
}
