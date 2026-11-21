'use client';

import { Alert, Button, Card, CardTitle } from '@eguardimmo/ui';
import type { SelectOption } from '@eguardimmo/ui';
import { useState } from 'react';
import { LinkButton, PageHeader, noticeAfterNavigation, useGestionNavigation } from '../../locataires/kit';
import { todayIso } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';
import { useSubjectChoices } from '../useSubjects';
import { libraryFailure } from './formErrors';
import type { LibraryFailure } from './formErrors';
import { useFileLibraryDocument, useLibraryPermissions } from './hooks';
import { LibraryFormFields } from './LibraryFormFields';
import { issuedDocumentLinks, libraryPaths } from './paths';
import { EMPTY_LIBRARY_FORM, toNewDocument, validateLibraryForm } from './validation';
import type { LibraryFormValues } from './validation';

const NO_FAILURE: LibraryFailure = { fields: {}, general: null };

export function LibraryAddPage({ mandateOptions = [] }: { mandateOptions?: readonly SelectOption[] }) {
  const permissions = useLibraryPermissions();
  const choices = useSubjectChoices();
  const file = useFileLibraryDocument();
  const { Link, push } = useGestionNavigation();
  const [form, setForm] = useState<LibraryFormValues>(EMPTY_LIBRARY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<LibraryFailure>(NO_FAILURE);

  const local = validateLibraryForm(form, choices.organizationId, todayIso());
  const errors = submitted ? { ...failure.fields, ...local } : failure.fields;
  const update = (patch: Partial<LibraryFormValues>) => {
    setForm((current) => ({ ...current, ...patch }));
    setFailure(NO_FAILURE);
  };

  const submit = async () => {
    setSubmitted(true);
    setFailure(NO_FAILURE);
    const document = toNewDocument(form, choices.organizationId);
    if (Object.keys(local).length > 0 || document === null) return;
    try {
      const created = await file.mutateAsync(document);
      noticeAfterNavigation({ title: 'Document déposé', description: `« ${created.file.name} » est dans la bibliothèque ; l’analyse antivirus est en cours.` });
      push(libraryPaths.documents);
    } catch (error) {
      setFailure(libraryFailure(error));
    }
  };

  return (
    <form noValidate className="flex min-w-0 flex-col gap-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Documents', href: libraryPaths.documents }, { label: 'Ajouter un document' }]}
        title="Ajouter un document"
        subtitle="Déposez le fichier, puis rattachez-le à un mandat, un bail ou un bien."
      />
      {permissions.write ? null : <Alert tone="warning" title="Dépôt réservé">Votre rôle ne permet pas de déposer un document.</Alert>}
      {failure.general ? <Alert tone="danger" title="Le document n’a pas été déposé">{failure.general}</Alert> : null}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <LibraryFormFields form={form} errors={errors} options={{ units: choices.unitOptions, leases: choices.leaseOptions, mandates: mandateOptions }} onChange={update} />
        </div>
        <Card role="region" aria-labelledby="library-elsewhere-title" className="gap-2 px-4 py-3">
          <CardTitle as="h2" id="library-elsewhere-title">Pièces produites ailleurs</CardTitle>
          <p className="text-caption text-fg-subtle">Ces pièces ne se déposent pas ici : elles sont émises par leur écran.</p>
          <ul className="flex flex-col">
            {issuedDocumentLinks.map((item) => (
              <li key={item.href} className="border-t border-line first:border-t-0">
                <Link href={item.href} className="flex min-h-6 items-center py-1 text-body text-action-on-subtle underline-offset-2 hover:underline">{item.label}</Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <LinkButton href={libraryPaths.documents}>Annuler</LinkButton>
        <Button type="submit" variant="primary" loading={file.isPending} disabled={!permissions.write || form.hasExpiry}>Déposer le document</Button>
      </div>
    </form>
  );
}
