'use client';

import { Button, Select, TextField } from '@eguardimmo/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useOrgMembers } from '../orgapi/hooks';
import { filterFormSchema, toFormValues } from './filters';
import type { FilterFormValues } from './filters';
import { SUBJECT_TYPES, typeBadge } from './labels';
import { ACTIVITY_TYPES, EMPTY_FILTERS } from './model';
import type { ActivityFilters } from './model';

const ALL = '';

export interface ActivityFiltersFormProps {
  applied: ActivityFilters;
  showActor: boolean;
  showSubject: boolean;
  onApply: (filters: ActivityFilters) => void;
}

export function ActivityFiltersForm({ applied, showActor, showSubject, onApply }: ActivityFiltersFormProps) {
  const members = useOrgMembers();
  const form = useForm<FilterFormValues, undefined, ActivityFilters>({ resolver: zodResolver(filterFormSchema), defaultValues: toFormValues(applied), mode: 'onSubmit', reValidateMode: 'onChange' });
  const errors = form.formState.errors;
  const actors = members.data?.choices ?? [];

  const submit = form.handleSubmit((filters) => { onApply(filters); });
  const reset = () => {
    form.reset(toFormValues(EMPTY_FILTERS));
    onApply(EMPTY_FILTERS);
  };

  return (
    <form noValidate aria-label="Filtres du journal" className="flex flex-col gap-3" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
      <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <TextField label="Du (inclus)" type="date" placeholder="AAAA-MM-JJ" error={errors.from?.message} {...form.register('from')} />
        <TextField label="Au (inclus)" type="date" placeholder="AAAA-MM-JJ" error={errors.to?.message} {...form.register('to')} />
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <Select label="Type d’action" placeholder="Tous les types" options={[{ value: ALL, label: 'Tous les types' }, ...ACTIVITY_TYPES.map((value) => ({ value, label: typeBadge[value].label }))]} value={field.value} onValueChange={field.onChange} />
          )}
        />
        {showActor && actors.length > 0 ? (
          <Controller
            control={form.control}
            name="actor"
            render={({ field }) => (
              <Select label="Auteur" placeholder="Tous les auteurs" searchable options={[{ value: ALL, label: 'Tous les auteurs' }, ...actors.map((member) => ({ value: member.userId, label: member.name }))]} value={field.value} onValueChange={field.onChange} />
            )}
          />
        ) : null}
        {showSubject ? (
          <>
            <Controller
              control={form.control}
              name="subjectType"
              render={({ field }) => (
                <Select label="Type d’élément" placeholder="Tous les éléments" options={[{ value: ALL, label: 'Tous les éléments' }, ...SUBJECT_TYPES]} value={field.value} onValueChange={field.onChange} error={errors.subjectType?.message} />
              )}
            />
            <TextField label="Identifiant de l’élément" placeholder="Identifiant" error={errors.subjectId?.message} {...form.register('subjectId')} />
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={reset}>Réinitialiser</Button>
        <Button type="submit">Appliquer les filtres</Button>
      </div>
    </form>
  );
}
