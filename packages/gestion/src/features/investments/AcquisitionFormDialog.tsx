'use client';

import { Button, Dialog, DialogClose, DialogContent, TextField } from '@eguardimmo/ui';
import { useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import type { Currency } from '../../format/money';
import { amountHint, minorToInput } from '../finances/banking/money';
import { useAttemptKey } from '../finances/ownerfunds/attemptKey';
import { FilePicker, useNotify } from '../locataires/kit';
import { ActionError } from '../orgapi/ActionError';
import { FormSelect, useOrgForm } from '../orgapi/form';
import { useOrgPropertyChoices, useOrgUnitChoices } from '../orgapi/hooks';
import { FILE_ACCEPT, acquisitionFormSchema, acquisitionToInput, acquisitionToUpdate, validateFile } from './forms';
import type { AcquisitionFormValues } from './forms';
import { useCreateAcquisition, useUpdateAcquisition } from './hooks';
import type { Acquisition } from './model';

const EMPTY: AcquisitionFormValues = { propertyId: '', unitId: '', acquiredOn: '', price: '', acquisitionCosts: '', agencyFees: '', initialWorks: '' };

const valuesOf = (acquisition: Acquisition, currency: Currency): AcquisitionFormValues => ({
  propertyId: acquisition.propertyId,
  unitId: acquisition.unitId ?? '',
  acquiredOn: acquisition.acquiredOn,
  price: minorToInput(acquisition.price.amount, currency),
  acquisitionCosts: minorToInput(acquisition.acquisitionCosts.amount, currency),
  agencyFees: minorToInput(acquisition.agencyFees.amount, currency),
  initialWorks: minorToInput(acquisition.initialWorks.amount, currency),
});

export function AcquisitionFormDialog({ open, currency, editing, onClose }: { open: boolean; currency: Currency | null; editing: Acquisition | null; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        title={editing ? 'Modifier le coût de revient' : 'Ajouter un coût de revient'}
        description="Prix d’achat et frais d’acquisition : le coût de revient sert au calcul de la rentabilité. Le bien et le lot ne se modifient pas."
        className="max-w-[560px]"
      >
        {currency === null ? (
          <p className="p-4 text-body text-fg-muted">La devise de votre organisation n’est pas prise en charge par ce formulaire.</p>
        ) : open ? (
          <AcquisitionForm currency={currency} editing={editing} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AcquisitionForm({ currency, editing, onClose }: { currency: Currency; editing: Acquisition | null; onClose: () => void }) {
  const create = useCreateAcquisition();
  const update = useUpdateAcquisition();
  const notify = useNotify();
  const keyFor = useAttemptKey();
  const properties = useOrgPropertyChoices();
  const schema = useMemo(() => acquisitionFormSchema(currency), [currency]);
  const form = useOrgForm<AcquisitionFormValues, AcquisitionFormValues>(schema, editing ? valuesOf(editing, currency) : EMPTY);
  const [document, setDocument] = useState<File | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const propertyId = useWatch({ control: form.control, name: 'propertyId' });
  const units = useOrgUnitChoices(propertyId === '' ? null : propertyId);
  const errors = form.formState.errors;

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, input: acquisitionToUpdate(values, currency, editing.lockVersion) });
        notify({ title: 'Coût de revient modifié' });
      } else {
        await create.mutateAsync({ input: acquisitionToInput(values, currency, document), key: keyFor(JSON.stringify([values, document?.name ?? null, document?.size ?? null])) });
        notify({ title: 'Coût de revient enregistré' });
      }
      onClose();
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <form noValidate className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-4" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
      <FormSelect control={form.control} name="propertyId" label="Bien acquis *" placeholder="Choisissez un bien" searchable disabled={editing !== null} options={(properties.data ?? []).map((property) => ({ value: property.id, label: property.name }))} />
      <FormSelect control={form.control} name="unitId" label="Lot acquis" placeholder="Bien entier" disabled={editing !== null || propertyId === ''} options={[{ value: '', label: 'Bien entier' }, ...(units.data ?? []).map((unit) => ({ value: unit.id, label: unit.reference }))]} />
      <TextField label="Date d’acquisition *" type="date" placeholder="AAAA-MM-JJ" error={errors.acquiredOn?.message} {...form.register('acquiredOn')} data-autofocus />
      <TextField label="Prix d’achat *" inputMode="decimal" placeholder={amountHint(currency)} error={errors.price?.message} {...form.register('price')} />
      <TextField label="Frais d’acquisition (notaire, droits)" inputMode="decimal" placeholder={amountHint(currency)} error={errors.acquisitionCosts?.message} {...form.register('acquisitionCosts')} />
      <TextField label="Frais d’agence" inputMode="decimal" placeholder={amountHint(currency)} error={errors.agencyFees?.message} {...form.register('agencyFees')} />
      <TextField label="Travaux initiaux" inputMode="decimal" placeholder={amountHint(currency)} error={errors.initialWorks?.message} {...form.register('initialWorks')} />
      {editing ? null : <FilePicker label="Acte d’achat (facultatif)" hint="PDF, JPG ou PNG, 10 Mo au plus" accept={FILE_ACCEPT} validate={validateFile} file={document} onFile={setDocument} />}
      {failure === null ? null : <ActionError title="Coût de revient non enregistré" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={form.formState.isSubmitting}>{editing ? 'Enregistrer' : 'Ajouter'}</Button>
      </div>
    </form>
  );
}
