'use client';

import { Button, Icon, IconButton, TextField } from '@eguardimmo/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useWatch } from 'react-hook-form';
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { moneyText } from './labels';
import type { ChargeKey, Expense, UnitChoice } from './model';
import { FormSelect } from './parts/form';
import { consumptionPath, itemPath, sourcePath } from './parts/paths';
import { keyTarget, unitTarget } from './itemsMapping';
import type { ItemsFormOutput, ItemsFormValues } from './schemas';
import { formatDateFr } from '../../locataires/kit/dates';
import { minorDigits } from '../../../format/money';
import type { Currency } from '../../../format/money';

export interface ItemChoices {
  keys: readonly ChargeKey[];
  units: readonly UnitChoice[];
  expenses: readonly Expense[];
  rubrics: readonly { value: string; label: string }[];
  currency: Currency;
}

export interface ItemFieldsProps {
  control: Control<ItemsFormValues, undefined, ItemsFormOutput>;
  register: UseFormRegister<ItemsFormValues>;
  errors: FieldErrors<ItemsFormValues>;
  index: number;
  choices: ItemChoices;
  onRemove: () => void;
}

export function ItemFields({ control, register, errors, index, choices, onRemove }: ItemFieldsProps) {
  const target = useWatch({ control, name: itemPath(index, 'target') });
  const consumption = choices.keys.find((key) => keyTarget(key.id) === target)?.kind === 'consumption';
  const itemErrors = errors.items?.[index];
  const targets = [
    ...choices.keys.filter((key) => !key.archived).map((key) => ({ value: keyTarget(key.id), label: `Clé : ${key.label}` })),
    ...choices.units.map((unit) => ({ value: unitTarget(unit.id), label: `Lot : ${unit.reference}` })),
  ];

  return (
    <li className="flex flex-col gap-3 rounded-md border border-line p-3">
      <div className="flex items-start justify-between gap-2">
        <b className="text-body-strong text-fg">{`Poste ${String(index + 1)}`}</b>
        <IconButton label={`Retirer le poste ${String(index + 1)}`} icon={Trash2} size="sm" onClick={onRemove} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField label="Libellé du poste *" placeholder="ex. Entretien des parties communes" error={itemErrors?.label?.message} {...register(itemPath(index, 'label'))} />
        <FormSelect control={control} name={itemPath(index, 'rubric')} label="Rubrique *" placeholder="ex. Entretien" options={choices.rubrics} />
        <FormSelect control={control} name={itemPath(index, 'target')} label="Répartition *" placeholder="Clé de répartition ou lot" options={targets} />
      </div>
      <Sources control={control} register={register} errors={errors} index={index} choices={choices} />
      {consumption ? <Consumptions control={control} register={register} errors={errors} index={index} units={choices.units} /> : null}
    </li>
  );
}

function Sources({ control, register, errors, index, choices }: Omit<ItemFieldsProps, 'onRemove'>) {
  const sources = useFieldArray({ control, name: itemPath(index, 'sources') });
  const itemErrors = errors.items?.[index];
  const sourcesError = itemErrors?.sources?.root?.message ?? itemErrors?.sources?.message;
  const amountPlaceholder = minorDigits(choices.currency) === 0 ? 'ex. 60000' : 'ex. 600,50';
  const options = choices.expenses.map((expense) => ({
    value: expense.id,
    label: `${formatDateFr(expense.documentOn)} · ${expense.payeeLabel ?? expense.reference ?? 'Dépense'}`,
    description: `TTC ${moneyText(expense.totalGross)} · récupérable ${moneyText(expense.recoverableAmount)}`,
  }));

  return (
    <fieldset className="flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1 p-0 text-caption text-fg-muted">Dépenses retenues *</legend>
      {sources.fields.map((field, sourceIndex) => (
        <div key={field.id} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
          <FormSelect control={control} name={sourcePath(index, sourceIndex, 'id')} label="Dépense" placeholder="Choisissez une dépense enregistrée" options={options} searchable emptyLabel="Aucune dépense enregistrée sur ce bien" />
          <TextField
            label="Montant retenu"
            inputMode="decimal"
            placeholder={`Part proposée, ${amountPlaceholder}`}
            error={itemErrors?.sources?.[sourceIndex]?.amount?.message}
            {...register(sourcePath(index, sourceIndex, 'amount'))}
          />
          <IconButton label={`Retirer la dépense ${String(sourceIndex + 1)}`} icon={Trash2} size="sm" onClick={() => { sources.remove(sourceIndex); }} />
        </div>
      ))}
      {sourcesError === undefined ? null : <span role="alert" className="text-caption text-fg-danger">{sourcesError}</span>}
      <div>
        <Button variant="ghost" size="sm" onClick={() => { sources.append({ id: '', amount: '' }); }}>
          <Icon icon={Plus} />
          Ajouter une dépense
        </Button>
      </div>
    </fieldset>
  );
}

function Consumptions({ control, register, errors, index, units }: Omit<ItemFieldsProps, 'onRemove' | 'choices'> & { units: readonly UnitChoice[] }) {
  const rows = useFieldArray({ control, name: itemPath(index, 'consumptions') });
  const itemErrors = errors.items?.[index];
  return (
    <fieldset className="flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1 p-0 text-caption text-fg-muted">Consommation par lot</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {rows.fields.map((field, rowIndex) => (
          <TextField
            key={field.id}
            label={units.find((unit) => unit.id === field.unitId)?.reference ?? 'Lot'}
            inputMode="decimal"
            placeholder="ex. 12,5"
            error={itemErrors?.consumptions?.[rowIndex]?.quantity?.message}
            {...register(consumptionPath(index, rowIndex, 'quantity'))}
          />
        ))}
      </div>
    </fieldset>
  );
}
