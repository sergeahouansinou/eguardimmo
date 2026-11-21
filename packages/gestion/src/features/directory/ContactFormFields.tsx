'use client';

import { Button, Chip, Icon, IconButton, RadioGroup, Select, Textarea, TextField } from '@eguardimmo/ui';
import { Plus, Trash2 } from 'lucide-react';
import { Controller, useFieldArray, useWatch } from 'react-hook-form';
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import type { ContactFormOutput, ContactFormValues } from './formSchema';
import { COUNTRIES, NOTE_HINT, kindLabel, languageLabel, pointTypeLabel } from './labels';
import { CONTACT_KINDS, CONTACT_LANGUAGES, CONTACT_POINT_TYPES, MAX_CONTACT_POINTS, MAX_NOTE_LENGTH } from './model';
import type { CategoryChoice, TagChoice } from './model';

export interface ContactFieldsProps {
  control: Control<ContactFormValues, undefined, ContactFormOutput>;
  register: UseFormRegister<ContactFormValues>;
  errors: FieldErrors<ContactFormValues>;
  mode: 'create' | 'edit';
  categories: readonly CategoryChoice[];
  tags: readonly TagChoice[];
}

export function ContactFields({ control, register, errors, mode, categories, tags }: ContactFieldsProps) {
  const kind = useWatch({ control, name: 'kind' });
  const note = useWatch({ control, name: 'note' });
  return (
    <>
      {mode === 'create' ? (
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <RadioGroup label="Type de contact" value={field.value} onValueChange={field.onChange} options={CONTACT_KINDS.map((value) => ({ value, label: kindLabel[value] }))} />
          )}
        />
      ) : (
        <p className="text-body text-fg-muted">{`Type : ${kindLabel[kind]} (non modifiable)`}</p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {kind === 'person' ? (
          <>
            <TextField label="Nom *" placeholder="ex. Sanvi" autoComplete="off" error={errors.lastName?.message} {...register('lastName')} />
            <TextField label="Prénom" placeholder="ex. Rodrigue" autoComplete="off" error={errors.firstName?.message} {...register('firstName')} />
          </>
        ) : (
          <TextField label="Raison sociale *" placeholder="ex. Plomberie Sanvi" autoComplete="off" error={errors.companyName?.message} {...register('companyName')} />
        )}
        <Controller
          control={control}
          name="language"
          render={({ field }) => (
            <Select label="Langue" placeholder="Langue" options={CONTACT_LANGUAGES.map((value) => ({ value, label: languageLabel[value] }))} value={field.value} onValueChange={field.onChange} />
          )}
        />
      </div>
      <fieldset className="flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-1 p-0 text-body-strong text-fg">Adresse</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="Rue" placeholder="ex. 12 rue des Lilas" autoComplete="off" error={errors.line1?.message} {...register('line1')} />
          <TextField label="Complément" placeholder="ex. Bâtiment B" autoComplete="off" error={errors.line2?.message} {...register('line2')} />
          <TextField label="Code postal" placeholder="ex. 75011" autoComplete="off" error={errors.postalCode?.message} {...register('postalCode')} />
          <TextField label="Ville" placeholder="ex. Paris" autoComplete="off" error={errors.city?.message} {...register('city')} />
          <Controller
            control={control}
            name="country"
            render={({ field }) => <Select label="Pays" placeholder="Pays" options={COUNTRIES} value={field.value} onValueChange={field.onChange} error={errors.country?.message} />}
          />
        </div>
      </fieldset>
      {mode === 'create' ? <ContactPointsFields control={control} register={register} errors={errors} /> : null}
      <Choices control={control} name="categoryIds" legend="Catégories" empty="Aucune catégorie n’est définie pour votre organisation." options={categories.map((category) => ({ id: category.id, label: category.label }))} />
      <Choices control={control} name="tagIds" legend="Spécialités et étiquettes" empty="Aucune étiquette n’est définie pour votre organisation." options={tags.map((tag) => ({ id: tag.id, label: tag.name }))} />
      <Textarea label="Note" placeholder="ex. Intervient sous 48 h" rows={3} maxLength={MAX_NOTE_LENGTH + 100} hint={`${NOTE_HINT} ${String(note.length)}/${String(MAX_NOTE_LENGTH)}`} error={errors.note?.message} {...register('note')} />
    </>
  );
}

function Choices({ control, name, legend, empty, options }: { control: Control<ContactFormValues, undefined, ContactFormOutput>; name: 'categoryIds' | 'tagIds'; legend: string; empty: string; options: readonly { id: string; label: string }[] }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <fieldset className="flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-body-strong text-fg">{legend}</legend>
          {options.length === 0 ? (
            <p className="text-caption text-fg-subtle">{empty}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {options.map((option) => {
                const selected = field.value.includes(option.id);
                return (
                  <Chip key={option.id} pressed={selected} onClick={() => { field.onChange(selected ? field.value.filter((id) => id !== option.id) : [...field.value, option.id]); }}>
                    {option.label}
                  </Chip>
                );
              })}
            </div>
          )}
          {fieldState.error ? <p role="alert" className="text-caption text-fg-danger">{fieldState.error.message}</p> : null}
        </fieldset>
      )}
    />
  );
}

function ContactPointsFields({ control, register, errors }: Pick<ContactFieldsProps, 'control' | 'register' | 'errors'>) {
  const { fields, append, remove } = useFieldArray({ control, name: 'contactPoints' });
  const pointErrors = errors.contactPoints;
  return (
    <fieldset className="flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1 p-0 text-body-strong text-fg">Coordonnées</legend>
      {fields.length === 0 ? <p className="text-caption text-fg-subtle">Aucune coordonnée. Vous pourrez en ajouter depuis la fiche.</p> : null}
      {fields.map((field, index) => (
        <div key={field.id} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Controller
            control={control}
            name={`contactPoints.${String(index) as `${number}`}.type`}
            render={({ field: typeField }) => (
              <Select label="Type" placeholder="Type" options={CONTACT_POINT_TYPES.map((value) => ({ value, label: pointTypeLabel[value] }))} value={typeField.value} onValueChange={typeField.onChange} />
            )}
          />
          <TextField label="Coordonnée *" placeholder="ex. contact@exemple.fr" autoComplete="off" error={pointErrors?.[index]?.value?.message} {...register(`contactPoints.${String(index) as `${number}`}.value`)} />
          <TextField label="Interlocuteur" placeholder="ex. Rodrigue Sanvi" autoComplete="off" error={pointErrors?.[index]?.label?.message} {...register(`contactPoints.${String(index) as `${number}`}.label`)} />
          <IconButton label={`Retirer la coordonnée ${String(index + 1)}`} icon={Trash2} onClick={() => { remove(index); }} />
        </div>
      ))}
      {pointErrors?.message ? <p role="alert" className="text-caption text-fg-danger">{pointErrors.message}</p> : null}
      <div>
        <Button variant="secondary" size="sm" disabled={fields.length >= MAX_CONTACT_POINTS} onClick={() => { append({ type: 'email', value: '', label: '' }); }}>
          <Icon icon={Plus} />
          Ajouter une coordonnée
        </Button>
      </div>
    </fieldset>
  );
}
