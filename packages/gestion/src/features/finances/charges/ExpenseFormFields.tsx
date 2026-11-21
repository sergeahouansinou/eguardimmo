'use client';

import { Alert, RadioGroup, TextField } from '@eguardimmo/ui';
import { Controller, useWatch } from 'react-hook-form';
import type { Control, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { kindLabel, settlementHint, settlementLabel } from './labels';
import { EXPENSE_KINDS } from './model';
import type { ChargesPermissions, ExpenseSettlement } from './model';
import { FormSelect } from './parts/form';
import { usePropertyLabels, useRubricLabels, useTermLabels } from './parts/choices';
import { useUnitChoices } from './hooks';
import { allowedSettlements } from './permissions';
import { FILE_MIMES, MAX_FILE_BYTES } from './schemas';
import type { ExpenseFormOutput, ExpenseFormValues } from './schemas';
import { FilePicker } from '../../locataires/kit';
import type { Currency } from '../../../format/money';
import { minorDigits } from '../../../format/money';

export interface ExpenseFieldsProps {
  control: Control<ExpenseFormValues, undefined, ExpenseFormOutput>;
  register: UseFormRegister<ExpenseFormValues>;
  setValue: UseFormSetValue<ExpenseFormValues>;
  errors: Partial<Record<keyof ExpenseFormValues, { message?: string } | undefined>>;
  currency: Currency;
  permissions: ChargesPermissions;
}

const ACCEPT = FILE_MIMES.join(',');

export function ExpenseFields({ control, register, setValue, errors, currency, permissions }: ExpenseFieldsProps) {
  const [propertyId, kind, settlement, recoverable] = useWatch({ control, name: ['propertyId', 'kind', 'settlement', 'recoverableAmount'] });
  const properties = usePropertyLabels();
  const categories = useTermLabels('expense_category');
  const rubrics = useRubricLabels();
  const units = useUnitChoices(propertyId === '' ? null : propertyId);
  const settlements = allowedSettlements(permissions);
  const amountPlaceholder = minorDigits(currency) === 0 ? 'ex. 120000' : 'ex. 1200,50';
  const wantsRubric = recoverable.trim() !== '' && recoverable.trim() !== '0';

  return (
    <>
      <Controller
        control={control}
        name="kind"
        render={({ field }) => (
          <RadioGroup
            label="Nature de la pièce"
            value={field.value}
            onValueChange={(value) => {
              field.onChange(value);
              if (value === 'co_ownership_statement') setValue('settlement', 'none');
            }}
            options={EXPENSE_KINDS.map((value) => ({ value, label: kindLabel[value] }))}
          />
        )}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormSelect control={control} name="propertyId" label="Bien *" placeholder="Choisissez le bien" options={properties.options} searchable />
        <FormSelect
          control={control}
          name="unitId"
          label={kind === 'co_ownership_statement' ? 'Lot concerné *' : 'Lot concerné'}
          placeholder={propertyId === '' ? 'Choisissez d’abord le bien' : 'Tout l’immeuble'}
          options={[{ value: '', label: 'Tout l’immeuble' }, ...(units.data ?? []).map((unit) => ({ value: unit.id, label: unit.reference }))]}
          disabled={propertyId === ''}
        />
        <FormSelect control={control} name="categoryTermId" label="Catégorie *" placeholder="ex. Entretien des parties communes" options={categories.options} searchable />
        <TextField label="Fournisseur" placeholder="ex. Société Propreté Plus" error={errors.payeeLabel?.message} {...register('payeeLabel')} />
        <TextField label="Référence de la pièce" placeholder="ex. FAC-2026-014" error={errors.reference?.message} {...register('reference')} />
        <TextField label="Date de la pièce *" type="date" placeholder="AAAA-MM-JJ" error={errors.documentOn?.message} {...register('documentOn')} />
        <TextField label="Service rendu du *" type="date" placeholder="AAAA-MM-JJ" error={errors.serviceFrom?.message} {...register('serviceFrom')} />
        <TextField label="au (exclu) *" type="date" placeholder="AAAA-MM-JJ" error={errors.serviceTo?.message} {...register('serviceTo')} />
        <TextField label={`Montant TTC (${currency}) *`} inputMode="decimal" placeholder={amountPlaceholder} error={errors.totalGross?.message} {...register('totalGross')} />
        <TextField label="dont TVA" inputMode="decimal" placeholder="ex. 0" error={errors.taxAmount?.message} {...register('taxAmount')} />
        <TextField label="Part récupérable sur le locataire" inputMode="decimal" placeholder="ex. 0" hint="À refacturer au locataire dans la régularisation." error={errors.recoverableAmount?.message} {...register('recoverableAmount')} />
        <FormSelect control={control} name="recoverableRubric" label={wantsRubric ? 'Rubrique récupérable *' : 'Rubrique récupérable'} placeholder="ex. Entretien" options={[{ value: '', label: 'Aucune' }, ...rubrics.options]} />
        <FormSelect
          control={control}
          name="settlement"
          label="Mode de règlement *"
          placeholder="Choisissez le mode de règlement"
          options={settlements.map((value) => ({ value, label: settlementLabel[value], description: settlementHint[value] }))}
          disabled={kind === 'co_ownership_statement'}
        />
        <TextField label="Date de paiement" type="date" placeholder="AAAA-MM-JJ" error={errors.paidOn?.message} {...register('paidOn')} />
      </div>
      {isTrustLike(settlement) ? (
        <Alert tone="info" title="Double authentification requise">
          Ce mode de règlement engage les fonds du mandant : une preuve de double authentification de moins de 10 minutes est demandée à l’enregistrement, et au-delà du seuil de l’organisation un second membre doit valider.
        </Alert>
      ) : null}
      <Controller
        control={control}
        name="document"
        render={({ field, fieldState }) => (
          <FilePicker
            label="Pièce justificative"
            hint="PDF, JPG ou PNG, 10 Mo au maximum."
            accept={ACCEPT}
            file={field.value}
            onFile={field.onChange}
            error={fieldState.error?.message}
            validate={(file) => {
              if (file.size > MAX_FILE_BYTES) return 'La pièce dépasse 10 Mo.';
              return FILE_MIMES.some((mime) => mime === file.type) ? null : 'La pièce doit être un PDF, un JPG ou un PNG.';
            }}
          />
        )}
      />
    </>
  );
}

function isTrustLike(settlement: ExpenseSettlement): boolean {
  return settlement === 'trust' || settlement === 'own_funds_advance';
}
