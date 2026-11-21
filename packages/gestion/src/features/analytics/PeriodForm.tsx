'use client';

import { Button, TextField } from '@eguardimmo/ui';
import { useOrgForm } from '../orgapi/form';
import { periodFormSchema } from './period';
import type { PeriodFormValues } from './period';

export function PeriodForm({ initial, onApply }: { initial: PeriodFormValues; onApply: (values: PeriodFormValues) => void }) {
  const form = useOrgForm<PeriodFormValues, PeriodFormValues>(periodFormSchema, initial);
  const errors = form.formState.errors;
  return (
    <form noValidate className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.stopPropagation(); void form.handleSubmit(onApply)(event); }}>
      <TextField label="Du mois" type="month" placeholder="AAAA-MM" error={errors.fromMonth?.message} {...form.register('fromMonth')} />
      <TextField label="Au mois (inclus)" type="month" placeholder="AAAA-MM" error={errors.toMonth?.message} {...form.register('toMonth')} />
      <Button type="submit" variant="secondary">Afficher</Button>
    </form>
  );
}
