'use client';

import { Select, TextField } from '@eguardimmo/ui';
import type { SelectOption } from '@eguardimmo/ui';
import { Controller, useWatch } from 'react-hook-form';
import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { useOrgUnitChoices } from '../../orgapi';
import type { TaskFormOutput, TaskFormValues } from './schema';

type FormControl = Control<TaskFormValues, undefined, TaskFormOutput>;

function FormSelect({ control, name, onPicked, ...props }: { control: FormControl; name: keyof TaskFormValues; onPicked?: (value: string) => void; label: string; placeholder: string; options: readonly SelectOption[]; hint?: string; searchable?: boolean; disabled?: boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => <Select {...props} value={field.value} onValueChange={(value) => { field.onChange(value); onPicked?.(value); }} error={fieldState.error?.message} />}
    />
  );
}

export interface TaskFormFieldsProps {
  control: FormControl;
  register: UseFormRegister<TaskFormValues>;
  setValue: UseFormSetValue<TaskFormValues>;
  errors: FieldErrors<TaskFormValues>;
  assigneeOptions: readonly SelectOption[];
  assigneeHint?: string;
  propertyOptions: readonly SelectOption[];
  leaseOptions: readonly SelectOption[];
}

export function TaskFormFields({ control, register, setValue, errors, assigneeOptions, assigneeHint, propertyOptions, leaseOptions }: TaskFormFieldsProps) {
  const propertyId = useWatch({ control, name: 'propertyId' });
  const units = useOrgUnitChoices(propertyId === '' ? null : propertyId);
  const unitOptions = (units.data ?? []).map((unit): SelectOption => ({ value: unit.id, label: unit.reference }));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <TextField label="Titre *" placeholder="Ex. Relancer le syndic" maxLength={120} error={errors.title?.message} {...register('title')} />
      </div>
      <TextField label="Échéance *" type="date" placeholder="AAAA-MM-JJ" error={errors.dueOn?.message} {...register('dueOn')} />
      <TextField label="Rappel (jours avant l’échéance)" inputMode="numeric" placeholder="Ex. 3" hint="Laissez vide pour ne pas être rappelé." error={errors.remindDaysBefore?.message} {...register('remindDaysBefore')} />
      <div className="sm:col-span-2">
        <FormSelect control={control} name="assigneeUserId" label="Responsable" placeholder="Non assignée" options={[{ value: '', label: 'Non assignée' }, ...assigneeOptions]} hint={assigneeHint} searchable />
      </div>
      <FormSelect control={control} name="propertyId" onPicked={() => { setValue('unitId', ''); }} label="Bien" placeholder="Aucun bien" options={[{ value: '', label: 'Aucun bien' }, ...propertyOptions]} searchable />
      <FormSelect control={control} name="unitId" label="Lot" placeholder={propertyId === '' ? 'Choisissez d’abord un bien' : 'Aucun lot'} options={[{ value: '', label: 'Aucun lot' }, ...unitOptions]} disabled={propertyId === ''} searchable />
      <div className="sm:col-span-2">
        <FormSelect control={control} name="leaseId" label="Bail" placeholder="Aucun bail" options={[{ value: '', label: 'Aucun bail' }, ...leaseOptions]} searchable />
      </div>
    </div>
  );
}
