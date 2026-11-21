'use client';

import { Alert, Button, Dialog, DialogClose, DialogContent } from '@eguardimmo/ui';
import { useState } from 'react';
import { CertificateFormFields, EMPTY_FORM } from './CertificateFormFields';
import { formFailure } from './formErrors';
import type { FormFailure } from './formErrors';
import { useCertificateTypes, useRenewCertificate } from './hooks';
import { formatDateFr } from '../locataires/kit/dates';
import type { Certificate } from './model';
import { validateCertificate } from './validation';
import type { FormErrors } from './validation';
import { ListLoading, LoadError, useNotify } from '../locataires/kit';

export function RenewCertificateDialog({ certificate, onClose }: { certificate: Certificate | null; onClose: () => void }) {
  return (
    <Dialog open={certificate !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        title="Renouveler la pièce"
        description="Une nouvelle pièce remplace celle-ci ; l’historique reste consultable."
        className="max-h-[calc(100dvh-2rem)] max-w-[560px]"
      >
        {certificate ? <RenewForm certificate={certificate} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function RenewForm({ certificate, onClose }: { certificate: Certificate; onClose: () => void }) {
  const types = useCertificateTypes();
  const renew = useRenewCertificate();
  const notify = useNotify();
  const [form, setForm] = useState({ ...EMPTY_FORM, reference: certificate.reference ?? '' });
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<FormFailure>({ fields: {}, general: null });

  const type = types.data?.find((entry) => entry.id === certificate.type.id) ?? null;
  const local = validateCertificate(form, type, { fileRequired: false });
  const errors: FormErrors = submitted ? { ...failure.fields, ...local } : failure.fields;

  const submit = async () => {
    setSubmitted(true);
    setFailure({ fields: {}, general: null });
    if (Object.keys(local).length > 0) return;
    try {
      await renew.mutateAsync({ current: certificate, input: form });
      notify({ title: 'Pièce renouvelée', description: `${certificate.type.label} : la nouvelle pièce remplace l’ancienne.` });
      onClose();
    } catch (error) {
      setFailure(formFailure(error));
    }
  };

  if (types.isError) return <div className="p-4"><LoadError title={types.error?.message ?? 'Les types de pièces n’ont pas pu être chargés'} /></div>;
  if (!types.data) return <div className="p-4"><ListLoading label="Chargement du type de pièce" /></div>;

  return (
    <>
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
        <p className="text-body text-fg-muted">
          {`${certificate.type.label}${certificate.expiresOn ? `, échéance actuelle le ${formatDateFr(certificate.expiresOn)}` : ''}.`}
        </p>
        {failure.general ? <Alert tone="danger" title="La pièce n’a pas été renouvelée">{failure.general}</Alert> : null}
        <CertificateFormFields type={type} form={form} errors={errors} fileLabel="Nouveau justificatif" onChange={setForm} />
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line p-4">
        <DialogClose asChild>
          <Button variant="ghost">Annuler</Button>
        </DialogClose>
        <Button loading={renew.isPending} onClick={() => { void submit(); }}>Renouveler la pièce</Button>
      </div>
    </>
  );
}
