'use client';

import { Checkbox, Textarea, TextField } from '@eguardimmo/ui';
import { useEffect, useRef } from 'react';
import { useWatch } from 'react-hook-form';
import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { FormSelect } from '../../finances/charges/parts/form';
import { useOrgLeaseChoices, useOrgPropertyChoices, useOrgUnitChoices } from '../../orgapi/hooks';
import { zoneLabel } from '../../orgapi/zone';
import { EVENT_KINDS, RECURRENCES } from '../model';
import type { EventInput } from '../model';
import { AttendeesField } from './AttendeesField';
import { KIND_LABELS, RECURRENCE_LABELS, REMINDER_LABELS } from './labels';
import type { EventFormValues } from './schemas';

export interface EventFieldsProps {
  control: Control<EventFormValues, undefined, EventInput>;
  register: UseFormRegister<EventFormValues>;
  setValue: UseFormSetValue<EventFormValues>;
  errors: FieldErrors<EventFormValues>;
  timeZone: string;
}

export function EventFields({ control, register, setValue, errors, timeZone }: EventFieldsProps) {
  const [allDay, recurrence, propertyId, attendees] = useWatch({ control, name: ['allDay', 'recurrence', 'propertyId', 'attendees'] });
  const properties = useOrgPropertyChoices();
  const units = useOrgUnitChoices(propertyId === '' ? null : propertyId);
  const leases = useOrgLeaseChoices();
  const previousProperty = useRef(propertyId);
  useEffect(() => {
    if (previousProperty.current === propertyId) return;
    previousProperty.current = propertyId;
    setValue('unitId', '');
  }, [propertyId, setValue]);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormSelect control={control} name="kind" label="Type *" placeholder="Choisissez le type" options={EVENT_KINDS.map((value) => ({ value, label: KIND_LABELS[value] }))} />
        <TextField label="Titre *" placeholder="ex. Visite de l’appartement 12" maxLength={120} error={errors.title?.message} {...register('title')} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField label="Date *" type="date" placeholder="AAAA-MM-JJ" error={errors.startsOn?.message} {...register('startsOn')} />
        <TextField label="Heure" type="time" placeholder="HH:MM" hint={`Fuseau : ${zoneLabel(timeZone)}`} disabled={allDay} error={errors.startTime?.message} {...register('startTime')} />
        <div className="flex items-end pb-1">
          <Checkbox label="Toute la journée" {...register('allDay')} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormSelect control={control} name="recurrence" label="Récurrence" placeholder="Ne se répète pas" options={RECURRENCES.map((value) => ({ value, label: RECURRENCE_LABELS[value] }))} />
        {recurrence === 'none' ? null : <TextField label="Répéter jusqu’au" type="date" placeholder="AAAA-MM-JJ" hint="Laissez vide pour une série sans fin." error={errors.recurrenceUntil?.message} {...register('recurrenceUntil')} />}
        <FormSelect
          control={control}
          name="reminder"
          label="Rappel"
          placeholder="Aucun rappel"
          options={[{ value: '', label: 'Aucun rappel' }, { value: '60', label: REMINDER_LABELS[60] }, { value: '1440', label: REMINDER_LABELS[1440] }]}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormSelect
          control={control}
          name="propertyId"
          label="Bien"
          placeholder="Aucun bien"
          options={[{ value: '', label: 'Aucun bien' }, ...(properties.data ?? []).map((property) => ({ value: property.id, label: property.name }))]}
          searchable
        />
        <FormSelect
          control={control}
          name="unitId"
          label="Lot"
          placeholder={propertyId === '' ? 'Choisissez d’abord le bien' : 'Aucun lot'}
          options={[{ value: '', label: 'Aucun lot' }, ...(units.data ?? []).map((unit) => ({ value: unit.id, label: unit.reference }))]}
          disabled={propertyId === ''}
        />
        <FormSelect
          control={control}
          name="leaseId"
          label="Bail"
          placeholder="Aucun bail"
          options={[{ value: '', label: 'Aucun bail' }, ...(leases.data ?? []).map((lease) => ({ value: lease.id, label: `${lease.reference}${lease.tenantNames.length > 0 ? ` — ${lease.tenantNames.join(', ')}` : ''}` }))]}
          searchable
        />
      </div>
      <Textarea label="Notes" placeholder="Informations utiles pour l’événement" maxLength={1000} error={errors.notes?.message} {...register('notes')} />
      <AttendeesField value={attendees} onChange={(next) => { setValue('attendees', next, { shouldDirty: true, shouldValidate: true }); }} error={errors.attendees?.message ?? errors.root?.message} />
    </>
  );
}
