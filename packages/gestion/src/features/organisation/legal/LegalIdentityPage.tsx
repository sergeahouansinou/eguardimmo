'use client';

import { Alert, Button } from '@eguardimmo/ui';
import { useState } from 'react';
import { LegalApiError } from './api/legalErrors';
import { LegalIdentityFields } from './LegalIdentityFields';
import { emptyDraft, legalFormSchema, toDraft } from './form';
import { useLegalIdentity, useLegalPermissions, useSaveLegalIdentity } from './hooks';
import type { LegalIdentityState } from './model';
import { ListLoading, LoadError, PageHeader, errorMessage, useNotify } from '../../locataires/kit';
import { useZodForm } from '../../locataires/kit/useZodForm';
import { links } from '../../locataires/kit/links';

export function LegalIdentityPage() {
  const query = useLegalIdentity();
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Réglages' }]}
        title="Réglages"
        subtitle="Identité légale de l’agence, imprimée sur les factures et les documents émis."
      />
      {query.isError ? <LoadError title={query.error?.message ?? 'L’identité légale n’a pas pu être chargée'} /> : null}
      {query.isPending && !query.isError ? <ListLoading label="Chargement de l’identité légale" /> : null}
      {query.data ? <LegalIdentityForm state={query.data} /> : null}
    </>
  );
}

function LegalIdentityForm({ state }: { state: LegalIdentityState }) {
  const permissions = useLegalPermissions();
  const save = useSaveLegalIdentity();
  const notify = useNotify();
  const initial = state.identity ? toDraft(state.identity) : emptyDraft(state.country);
  const form = useZodForm(legalFormSchema(state.currency), initial);
  const [failure, setFailure] = useState<string | null>(null);
  const readOnly = !permissions.edit;

  const submit = async () => {
    setFailure(null);
    const values = form.submit();
    if (!values) return;
    try {
      await save.mutateAsync(values);
      notify({ title: 'Identité légale enregistrée', description: 'Elle sera reprise sur les prochains documents émis.' });
    } catch (error) {
      setFailure(error instanceof LegalApiError ? error.message : errorMessage(error));
    }
  };

  return (
    <form
      noValidate
      aria-label="Identité légale"
      className="flex min-w-0 flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {state.identity === null ? (
        <Alert tone="warning" title="Identité légale non renseignée">
          Elle est nécessaire pour émettre des factures : complétez le siège de l’agence puis enregistrez.
        </Alert>
      ) : null}
      {readOnly ? (
        <Alert tone="info" title="Lecture seule">
          Seuls le titulaire et les administrateurs peuvent modifier l’identité légale.
        </Alert>
      ) : null}
      {failure ? <Alert tone="danger" title="Enregistrement impossible">{failure}</Alert> : null}
      <LegalIdentityFields form={form} currency={state.currency} readOnly={readOnly} />
      {readOnly ? null : (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => { form.reset(initial); setFailure(null); }}>Annuler les modifications</Button>
          <Button type="submit" loading={save.isPending}>Enregistrer</Button>
        </div>
      )}
    </form>
  );
}
