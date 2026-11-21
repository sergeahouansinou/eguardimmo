'use client';

import { Alert, Button, Dialog, DialogClose, DialogContent, Select } from '@eguardimmo/ui';
import { useState } from 'react';
import { CertificateFormFields, EMPTY_FORM } from './CertificateFormFields';
import { formFailure } from './formErrors';
import type { FormFailure } from './formErrors';
import { useCertificateTypes, useCreateCertificate } from './hooks';
import { EMPTY_SUBJECT, SubjectFields, subjectOf } from './SubjectFields';
import { useSubjectChoices } from './useSubjects';
import { validateCertificate } from './validation';
import type { FormErrors } from './validation';
import { ListLoading, LoadError, useNotify } from '../locataires/kit';

export function AddCertificateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Ajouter une pièce" description="Diagnostic, assurance, carte professionnelle… avec son justificatif." className="max-h-[calc(100dvh-2rem)] max-w-[560px]">
        {open ? <AddForm onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AddForm({ onClose }: { onClose: () => void }) {
  const types = useCertificateTypes();
  const choices = useSubjectChoices();
  const create = useCreateCertificate();
  const notify = useNotify();
  const [typeId, setTypeId] = useState('');
  const [subject, setSubject] = useState(EMPTY_SUBJECT);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<FormFailure>({ fields: {}, general: null });

  const type = types.data?.find((entry) => entry.id === typeId) ?? null;
  const target = subjectOf(subject, choices.organizationId);
  const local: FormErrors = {
    ...validateCertificate(form, type, { fileRequired: false }),
    ...(target === null ? { subject: 'Choisissez l’objet concerné.' } : {}),
  };
  const errors: FormErrors = submitted ? { ...failure.fields, ...local } : failure.fields;

  const submit = async () => {
    setSubmitted(true);
    setFailure({ fields: {}, general: null });
    if (Object.keys(local).length > 0 || type === null || target === null) return;
    try {
      await create.mutateAsync({ subject: target, typeId: type.id, reference: form.reference, issuedOn: form.issuedOn, expiresOn: form.expiresOn, values: form.values, file: form.file });
      notify({ title: 'Pièce ajoutée', description: `${type.label} a été enregistrée.` });
      onClose();
    } catch (error) {
      setFailure(formFailure(error));
    }
  };

  if (types.isError) return <div className="p-4"><LoadError title={types.error?.message ?? 'Les types de pièces n’ont pas pu être chargés'} /></div>;
  if (!types.data) return <div className="p-4"><ListLoading label="Chargement des types de pièces" /></div>;

  return (
    <>
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
        {failure.general ? <Alert tone="danger" title="La pièce n’a pas été enregistrée">{failure.general}</Alert> : null}
        <Select
          label="Type de pièce *"
          placeholder="Choisir un type, ex. Diagnostic gaz"
          options={types.data.map((entry) => ({ value: entry.id, label: entry.label }))}
          value={typeId}
          onValueChange={(value) => { setTypeId(value); setForm((current) => ({ ...current, values: {} })); }}
          searchable
          searchPlaceholder="Rechercher un type"
          error={errors.typeId}
        />
        <SubjectFields draft={subject} choices={choices} error={errors.subject} onChange={setSubject} />
        <CertificateFormFields type={type} form={form} errors={errors} fileLabel="Justificatif" onChange={setForm} />
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line p-4">
        <DialogClose asChild>
          <Button variant="ghost">Annuler</Button>
        </DialogClose>
        <Button loading={create.isPending} onClick={() => { void submit(); }}>Ajouter la pièce</Button>
      </div>
    </>
  );
}
