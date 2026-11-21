'use client';

import { Button, Dialog, DialogClose, DialogContent, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { useNotify } from '../../locataires/kit';
import { FormSelect, useTenantRequestsForm } from '../shared/form';
import { ActionError } from '../shared/parts/ActionError';
import { useUpdateInspection } from './hooks';
import { INSPECTION_PERFORMERS, performerLabel } from './model';
import type { Inspection } from './model';
import { fromConformity, inspectionEditSchema, toConformity, trimSignatories } from './schemas';
import type { InspectionFormValues } from './schemas';
import { SignatoriesFields } from './SignatoriesFields';

export function EditInspectionDialog({ inspection, open, onClose }: { inspection: Inspection; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        title="Modifier l’état des lieux"
        description="Tant qu’il n’est pas publié, vous pouvez corriger la date, l’auteur du relevé, la conformité et les signataires. Le PDF ne change pas : enregistrez un nouvel état des lieux pour le remplacer."
        className="max-w-[720px]"
      >
        {open ? <EditForm inspection={inspection} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ inspection, onDone }: { inspection: Inspection; onDone: () => void }) {
  const update = useUpdateInspection();
  const notify = useNotify();
  const [failure, setFailure] = useState<unknown>(null);
  const form = useTenantRequestsForm<InspectionFormValues, InspectionFormValues>(inspectionEditSchema, {
    kind: inspection.kind,
    performedOn: inspection.performedOn,
    performedBy: inspection.performedBy,
    conformity: fromConformity(inspection.exitMatchesEntry),
    signatories: inspection.signatories,
    file: null,
  });

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await update.mutateAsync({
        id: inspection.id,
        lockVersion: inspection.lockVersion,
        changes: {
          performedOn: values.performedOn,
          performedBy: values.performedBy,
          exitMatchesEntry: toConformity(values.conformity),
          signatories: trimSignatories(values.signatories),
        },
      });
      notify({ title: 'État des lieux modifié', description: 'Les corrections sont enregistrées.' });
      onDone();
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <form noValidate className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-4" onSubmit={(event) => { event.stopPropagation(); void submit(event); }}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <TextField label="Réalisé le *" type="date" placeholder="AAAA-MM-JJ" error={form.formState.errors.performedOn?.message} {...form.register('performedOn')} />
        <FormSelect control={form.control} name="performedBy" label="Réalisé par *" placeholder="Qui a réalisé le relevé" options={INSPECTION_PERFORMERS.map((value) => ({ value, label: performerLabel[value] }))} />
      </div>
      {inspection.kind === 'exit' ? (
        <FormSelect
          control={form.control}
          name="conformity"
          label="Conformité à l’état d’entrée"
          placeholder="À renseigner avant la publication"
          options={[{ value: '', label: 'Non renseignée' }, { value: 'yes', label: 'Conforme à l’état d’entrée' }, { value: 'no', label: 'Différences avec l’état d’entrée' }]}
        />
      ) : null}
      <SignatoriesFields form={form} />
      {failure === null ? null : <ActionError title="Modification non enregistrée" error={failure} />}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={form.formState.isSubmitting}>Enregistrer les corrections</Button>
      </div>
    </form>
  );
}
