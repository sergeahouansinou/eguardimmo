'use client';

import { Button, Card, Icon, TextField } from '@eguardimmo/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFieldArray } from 'react-hook-form';
import { amountHint } from '../finances/banking/money';
import { useNotify } from '../locataires/kit';
import { ActionError } from '../orgapi/ActionError';
import { FormSelect, useOrgForm } from '../orgapi/form';
import { ITEMS_MAX, assumptionsDefaults, assumptionsSchema, assumptionsToInput } from './assumptionsSchema';
import type { AssumptionsFormValues } from './assumptionsSchema';
import { useSaveAssumptions } from './hooks';
import type { Forecast } from './model';

export function AssumptionsForm({ forecast, units }: { forecast: Forecast; units: readonly { id: string; label: string }[] }) {
  const { currency, assumptions } = forecast;
  const save = useSaveAssumptions();
  const notify = useNotify();
  const [failure, setFailure] = useState<unknown>(null);
  const schema = useMemo(() => assumptionsSchema(currency), [currency]);
  const form = useOrgForm<AssumptionsFormValues, AssumptionsFormValues>(schema, assumptionsDefaults(assumptions, currency));
  const vacancies = useFieldArray({ control: form.control, name: 'vacancies' });
  const expenses = useFieldArray({ control: form.control, name: 'oneOffExpenses' });
  const errors = form.formState.errors;

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await save.mutateAsync(assumptionsToInput(values, currency, assumptions.lockVersion));
      notify({ title: 'Hypothèses enregistrées', description: 'La projection a été recalculée.' });
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <Card className="gap-3">
      <h2 className="text-block-title text-fg">Hypothèses de la projection</h2>
      <p className="text-caption text-fg-subtle">Ces hypothèses sont les vôtres : aucun indice officiel n’est appliqué. Elles ne modifient aucun bail ni aucune écriture.</p>
      <form noValidate className="flex flex-col gap-4" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <TextField label="Indexation annuelle des loyers (%)" inputMode="decimal" placeholder="ex. 1,5" error={errors.indexationRate?.message} {...form.register('indexationRate')} />
          <TextField label="Hausse annuelle des dépenses (%)" inputMode="decimal" placeholder="ex. 2" error={errors.expenseGrowthRate?.message} {...form.register('expenseGrowthRate')} />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-body-strong text-fg">Périodes de vacance prévues</legend>
          {vacancies.fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
              <FormSelect control={form.control} name={`vacancies.${String(index) as `${number}`}.unitId`} label="Lot" placeholder="Choisissez un lot" searchable options={units.map((unit) => ({ value: unit.id, label: unit.label }))} />
              <TextField label="Du" type="date" placeholder="AAAA-MM-JJ" error={errors.vacancies?.[index]?.from?.message} {...form.register(`vacancies.${String(index) as `${number}`}.from`)} />
              <TextField label="Au" type="date" placeholder="AAAA-MM-JJ" error={errors.vacancies?.[index]?.to?.message} {...form.register(`vacancies.${String(index) as `${number}`}.to`)} />
              <Button variant="ghost" aria-label={`Retirer la vacance ${String(index + 1)}`} onClick={() => { vacancies.remove(index); }}>
                <Icon icon={Trash2} />
                Retirer
              </Button>
            </div>
          ))}
          <div>
            <Button variant="secondary" size="sm" disabled={vacancies.fields.length >= ITEMS_MAX} onClick={() => { vacancies.append({ unitId: '', from: '', to: '' }); }}>
              <Icon icon={Plus} />
              Ajouter une vacance
            </Button>
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-body-strong text-fg">Dépenses ponctuelles prévues</legend>
          {expenses.fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[auto_1fr_auto_auto]">
              <TextField label="Mois" type="month" placeholder="AAAA-MM" error={errors.oneOffExpenses?.[index]?.month?.message} {...form.register(`oneOffExpenses.${String(index) as `${number}`}.month`)} />
              <TextField label="Libellé" placeholder="ex. Ravalement de façade" error={errors.oneOffExpenses?.[index]?.label?.message} {...form.register(`oneOffExpenses.${String(index) as `${number}`}.label`)} />
              <TextField label="Montant" inputMode="decimal" placeholder={amountHint(currency)} error={errors.oneOffExpenses?.[index]?.amount?.message} {...form.register(`oneOffExpenses.${String(index) as `${number}`}.amount`)} />
              <Button variant="ghost" aria-label={`Retirer la dépense ${String(index + 1)}`} onClick={() => { expenses.remove(index); }}>
                <Icon icon={Trash2} />
                Retirer
              </Button>
            </div>
          ))}
          <div>
            <Button variant="secondary" size="sm" disabled={expenses.fields.length >= ITEMS_MAX} onClick={() => { expenses.append({ month: '', label: '', amount: '' }); }}>
              <Icon icon={Plus} />
              Ajouter une dépense
            </Button>
          </div>
        </fieldset>
        {failure === null ? null : <ActionError title="Hypothèses non enregistrées" error={failure} />}
        <div>
          <Button type="submit" loading={form.formState.isSubmitting}>Enregistrer les hypothèses</Button>
        </div>
      </form>
    </Card>
  );
}
