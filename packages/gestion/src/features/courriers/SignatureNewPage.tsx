'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardTitle, IconButton, Select, TextField } from '@eguardimmo/ui';
import { useState } from 'react';
import { useCreateSignature } from './hooks';
import { courriersPaths } from './paths';
import { signatureInputSchema } from './schemas';
import { useTenants } from '../locataires/hooks';
import { DescriptionList, FileDrop, PageHeader, Steps, errorMessage, noticeAfterNavigation, useGestionNavigation, useNotify } from '../locataires/kit';
import { links } from '../locataires/kit/links';
import { useZodForm } from '../locataires/kit/useZodForm';
import { tenantNameOf } from '../locataires/schemas';

const STEPS = ['Document', 'Signataires', 'Envoi'];
const MAX_BYTES = 20 * 1_048_576;

export function SignatureNewPage() {
  const { push } = useGestionNavigation();
  const notify = useNotify();
  const tenants = useTenants();
  const create = useCreateSignature();
  const form = useZodForm(signatureInputSchema, { title: '', fileName: '', signers: [{ name: '', email: '' }] });
  const [step, setStep] = useState(0);

  const parsed = signatureInputSchema.safeParse(form.values);
  const issues = parsed.success ? [] : parsed.error.issues.map((issue) => String(issue.path[0]));
  const stepFields: readonly (readonly string[])[] = [['title', 'fileName'], ['signers'], []];
  const blocked = (index: number) => stepFields[index]?.some((field) => issues.includes(field)) ?? false;

  const next = () => {
    form.touch('title');
    form.touch('fileName');
    form.touch('signers');
    if (blocked(step)) return;
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  };

  const send = async () => {
    const values = form.submit();
    if (!values) return;
    try {
      const saved = await create.mutateAsync(values);
      noticeAfterNavigation({ title: 'Demande envoyée', description: `${saved.title}, ${String(saved.signers.length)} signataire${saved.signers.length > 1 ? 's' : ''}.` });
      push(courriersPaths.signatures);
    } catch (error) {
      notify({ tone: 'danger', title: 'Envoi impossible', description: errorMessage(error) });
    }
  };

  const setSigner = (index: number, field: 'name' | 'email', value: string) => {
    form.setValue('signers', form.values.signers.map((signer, position) => (position === index ? { ...signer, [field]: value } : signer)));
  };

  const addTenant = (tenantId: string) => {
    const tenant = tenants.data?.find((entry) => entry.id === tenantId);
    if (!tenant) return;
    const filled = form.values.signers.filter((signer) => signer.name !== '' || signer.email !== '');
    form.setValue('signers', [...filled, { name: tenantNameOf(tenant), email: tenant.email }]);
  };

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); if (step < STEPS.length - 1) next(); else void send(); }}>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Documents', href: courriersPaths.documents }, { label: 'Signatures', href: courriersPaths.signatures }, { label: 'Nouvelle demande' }]}
        title="Nouvelle demande de signature"
        subtitle="Trois étapes : le document, les signataires, l’envoi."
      />
      <Steps steps={STEPS} current={step} label="Étapes de la demande" />
      <Card className="gap-3" role="group" aria-labelledby="sg-step">
        <CardTitle as="h2" id="sg-step">{`Étape ${String(step + 1)}, ${STEPS[step] ?? ''}`}</CardTitle>
        {step === 0 ? (
          <>
            <TextField
              label="Titre du document *"
              placeholder="Ex. Avenant au bail Studio B3"
              value={form.values.title}
              error={form.error('title')}
              onChange={(event) => { form.setValue('title', event.target.value); }}
              onBlur={() => { form.touch('title'); }}
            />
            <FileDrop
              title="Joindre le PDF à signer"
              hint="PDF uniquement, 20 Mo au maximum."
              accept="application/pdf"
              allowedTypes={['application/pdf']}
              maxBytes={MAX_BYTES}
              fileName={form.values.fileName}
              error={form.error('fileName')}
              onFile={(name) => { form.setValue('fileName', name); form.touch('fileName'); }}
            />
          </>
        ) : null}
        {step === 1 ? (
          <>
            <ul className="flex flex-col gap-3">
              {form.values.signers.map((signer, index) => (
                <li key={index} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <TextField label={`Nom du signataire ${String(index + 1)}`} placeholder="Ex. Yann Le Gall" value={signer.name} onChange={(event) => { setSigner(index, 'name', event.target.value); }} />
                  <TextField label={`E-mail du signataire ${String(index + 1)}`} type="email" placeholder="prenom.nom@example.com" value={signer.email} onChange={(event) => { setSigner(index, 'email', event.target.value); }} />
                  <IconButton
                    label={`Retirer le signataire ${String(index + 1)}`}
                    icon={Trash2}
                    disabled={form.values.signers.length === 1}
                    onClick={() => { form.setValue('signers', form.values.signers.filter((_, position) => position !== index)); }}
                  />
                </li>
              ))}
            </ul>
            {form.error('signers') ? <span role="alert" className="text-caption text-fg-danger">{form.error('signers')}</span> : null}
            <div className="flex flex-wrap items-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => { form.setValue('signers', [...form.values.signers, { name: '', email: '' }]); }}>
                <Plus size={14} aria-hidden="true" />
                Ajouter un signataire
              </Button>
              <Select
                label="Ajouter un locataire"
                hideLabel
                placeholder="Ajouter un locataire"
                searchable
                value=""
                onValueChange={addTenant}
                options={(tenants.data ?? []).filter((tenant) => tenant.status !== 'archive').map((tenant) => ({ value: tenant.id, label: tenantNameOf(tenant) }))}
                className="w-60"
              />
            </div>
          </>
        ) : null}
        {step === 2 ? (
          <DescriptionList
            termWidth="130px"
            items={[
              { term: 'Document', detail: form.values.title },
              { term: 'Fichier', detail: form.values.fileName },
              { term: 'Signataires', detail: form.values.signers.map((signer) => `${signer.name} (${signer.email})`).join(', ') },
            ]}
          />
        ) : null}
      </Card>
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" onClick={() => { push(courriersPaths.signatures); }}>Annuler</Button>
        <div className="flex gap-2">
          {step > 0 ? <Button variant="secondary" onClick={() => { setStep((current) => current - 1); }}>Précédent</Button> : null}
          {step < STEPS.length - 1 ? <Button type="submit">Suivant</Button> : <Button type="submit" loading={create.isPending}>Envoyer pour signature</Button>}
        </div>
      </div>
    </form>
  );
}
