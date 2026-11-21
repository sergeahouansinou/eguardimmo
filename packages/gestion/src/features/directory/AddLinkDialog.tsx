'use client';

import { Button, Dialog, DialogClose, DialogContent, Select } from '@eguardimmo/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useNotify } from '../locataires/kit';
import { ActionError } from '../orgapi/ActionError';
import { useOrgPropertyChoices, useOrgUnitChoices } from '../orgapi/hooks';
import { useAddPropertyLink, useContactCategories } from './hooks';

const NONE = '';
const linkSchema = z.object({ propertyId: z.string().min(1, 'Choisissez le bien.'), unitId: z.string(), categoryId: z.string() });
type LinkValues = z.input<typeof linkSchema>;
type LinkOutput = z.output<typeof linkSchema>;

export function AddLinkDialog({ contactId, open, onClose }: { contactId: string; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Rattacher à un bien" description="Choisissez le bien, puis le lot si le contact ne concerne qu’une partie du bien.">
        {open ? <AddLinkForm contactId={contactId} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AddLinkForm({ contactId, onClose }: { contactId: string; onClose: () => void }) {
  const add = useAddPropertyLink();
  const notify = useNotify();
  const properties = useOrgPropertyChoices();
  const categories = useContactCategories();
  const [failure, setFailure] = useState<unknown>(null);
  const form = useForm<LinkValues, undefined, LinkOutput>({ resolver: zodResolver(linkSchema), defaultValues: { propertyId: NONE, unitId: NONE, categoryId: NONE }, mode: 'onSubmit', reValidateMode: 'onChange' });
  const propertyId = useWatch({ control: form.control, name: 'propertyId' });
  const units = useOrgUnitChoices(propertyId === NONE ? null : propertyId);

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await add.mutateAsync({ propertyId: values.propertyId, input: { partyId: contactId, unitId: values.unitId === NONE ? null : values.unitId, categoryId: values.categoryId === NONE ? null : values.categoryId } });
      notify({ title: 'Contact rattaché au bien' });
      onClose();
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <form noValidate className="flex flex-col gap-3 p-4" onSubmit={(event) => { void submit(event); }}>
      <Controller
        control={form.control}
        name="propertyId"
        render={({ field, fieldState }) => (
          <Select
            label="Bien *"
            placeholder={properties.isPending ? 'Chargement des biens…' : 'Choisissez le bien'}
            options={(properties.data ?? []).map((property) => ({ value: property.id, label: property.name }))}
            value={field.value}
            onValueChange={(value) => { field.onChange(value); form.setValue('unitId', NONE); }}
            error={fieldState.error?.message ?? (properties.isError ? 'Les biens n’ont pas pu être chargés.' : undefined)}
            searchable
          />
        )}
      />
      <Controller
        control={form.control}
        name="unitId"
        render={({ field }) => (
          <Select
            label="Lot"
            placeholder={propertyId === NONE ? 'Choisissez d’abord le bien' : 'Tout le bien'}
            options={[{ value: NONE, label: 'Tout le bien' }, ...(units.data ?? []).map((unit) => ({ value: unit.id, label: unit.reference }))]}
            value={field.value}
            onValueChange={field.onChange}
            disabled={propertyId === NONE}
          />
        )}
      />
      <Controller
        control={form.control}
        name="categoryId"
        render={({ field }) => (
          <Select
            label="Rôle sur ce bien"
            placeholder="Aucun rôle précis"
            options={[{ value: NONE, label: 'Aucun rôle précis' }, ...(categories.data ?? []).map((category) => ({ value: category.id, label: category.label }))]}
            value={field.value}
            onValueChange={field.onChange}
          />
        )}
      />
      {failure === null ? null : <ActionError title="Rattachement impossible" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Annuler</Button>
        </DialogClose>
        <Button type="submit" loading={form.formState.isSubmitting}>Rattacher</Button>
      </div>
    </form>
  );
}
