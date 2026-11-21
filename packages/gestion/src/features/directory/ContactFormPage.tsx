'use client';

import { Alert, Button, Card } from '@eguardimmo/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ActionError } from '../orgapi/ActionError';
import { ConfirmAction } from '../orgapi/ConfirmAction';
import { OrgApiError } from '../orgapi/errors';
import { QueryState } from '../orgapi/QueryState';
import { LinkButton, ListLoading, PageHeader, noticeAfterNavigation, useGestionNavigation } from '../locataires/kit';
import { duplicateCandidatesOf } from './api/failures';
import { ContactFields } from './ContactFormFields';
import { DuplicateCandidates } from './DuplicateCandidates';
import { contactFormSchema, contactValuesOf, emptyContactValues, toContactFields, toContactInput } from './formSchema';
import type { ContactFormOutput, ContactFormValues } from './formSchema';
import { useContact, useContactCategories, useContactTags, useCreateContact, useReloadDirectory, useUpdateContact } from './hooks';
import type { CategoryChoice, ContactDetail, DuplicateCandidate, TagChoice } from './model';
import { DIRECTORY_CRUMBS, DirectoryGate } from './parts';
import { directoryPaths } from './paths';

export function ContactFormPage({ id }: { id?: string }) {
  return (
    <DirectoryGate need="write" title={id === undefined ? 'Nouveau contact' : 'Modifier le contact'}>
      {id === undefined ? <CreateContact /> : <EditContact id={id} />}
    </DirectoryGate>
  );
}

function useChoices(extraCategories: readonly CategoryChoice[] = [], extraTags: readonly TagChoice[] = []) {
  const categories = useContactCategories();
  const tags = useContactTags();
  const merge = <T extends { id: string }>(base: readonly T[] | undefined, extra: readonly T[]): T[] => [...(base ?? []), ...extra.filter((item) => !(base ?? []).some((known) => known.id === item.id))];
  return { categories, tags, categoryOptions: merge(categories.data, extraCategories), tagOptions: merge(tags.data, extraTags) };
}

function CreateContact() {
  const choices = useChoices();
  return (
    <>
      <PageHeader crumbs={[...DIRECTORY_CRUMBS, { label: 'Nouveau contact' }]} title="Nouveau contact" subtitle="Artisan, syndic, assureur, interlocuteur… Une même fiche sert à tous les biens." />
      <ChoicesState choices={choices} />
      {choices.categories.isPending || choices.tags.isPending ? <ListLoading label="Chargement du formulaire" /> : <ContactForm mode="create" defaults={emptyContactValues()} categories={choices.categoryOptions} tags={choices.tagOptions} />}
    </>
  );
}

function EditContact({ id }: { id: string }) {
  const contact = useContact(id);
  const reload = useReloadDirectory();
  const choices = useChoices(contact.data?.categories, contact.data?.tags);
  const crumbs = [...DIRECTORY_CRUMBS, ...(contact.data ? [{ label: contact.data.displayName, href: directoryPaths.contact(id) }] : []), { label: 'Modifier' }];
  const notFound = { title: 'Contact introuvable', description: 'Ce contact n’existe pas ou n’est plus accessible.', backHref: directoryPaths.contacts, backLabel: 'Retour aux contacts' };
  return (
    <>
      <PageHeader crumbs={crumbs} title="Modifier le contact" subtitle={contact.data?.displayName} />
      {contact.data === undefined ? (
        <QueryState query={contact} label="Chargement du contact" title="Impossible de charger le contact" notFound={notFound} onRetry={reload} />
      ) : contact.data.anonymized ? (
        <Alert tone="info" title="Contact anonymisé">Un contact anonymisé ne se modifie plus.</Alert>
      ) : (
        <>
          <ChoicesState choices={choices} />
          <ContactForm key={contact.data.lockVersion} mode="edit" contact={contact.data} defaults={contactValuesOf(contact.data)} categories={choices.categoryOptions} tags={choices.tagOptions} />
        </>
      )}
    </>
  );
}

function ChoicesState({ choices }: { choices: ReturnType<typeof useChoices> }) {
  if (choices.categories.isError || choices.tags.isError) {
    return <Alert tone="danger" title="Catégories ou étiquettes indisponibles">Elles n’ont pas pu être chargées : vous pouvez enregistrer la fiche sans les modifier, ou recharger la page.</Alert>;
  }
  return null;
}

interface ContactFormProps {
  mode: 'create' | 'edit';
  contact?: ContactDetail;
  defaults: ContactFormValues;
  categories: readonly CategoryChoice[];
  tags: readonly TagChoice[];
}

function ContactForm({ mode, contact, defaults, categories, tags }: ContactFormProps) {
  const { push } = useGestionNavigation();
  const create = useCreateContact();
  const update = useUpdateContact();
  const [failure, setFailure] = useState<unknown>(null);
  const [pending, setPending] = useState<{ values: ContactFormOutput; candidates: DuplicateCandidate[] } | null>(null);
  const form = useForm<ContactFormValues, undefined, ContactFormOutput>({ resolver: zodResolver(contactFormSchema), defaultValues: defaults, mode: 'onSubmit', reValidateMode: 'onChange' });
  const stale = failure instanceof OrgApiError && failure.kind === 'stale';

  const finish = (saved: ContactDetail, title: string) => {
    noticeAfterNavigation({ title, description: saved.displayName });
    push(directoryPaths.contact(saved.id));
  };

  const save = async (values: ContactFormOutput, allowDuplicate: boolean): Promise<void> => {
    if (mode === 'edit' && contact) {
      finish(await update.mutateAsync({ id: contact.id, lockVersion: contact.lockVersion, fields: toContactFields(values) }), 'Contact modifié');
      return;
    }
    finish(await create.mutateAsync({ input: toContactInput(values), allowDuplicate }), 'Contact créé');
  };

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await save(values, false);
    } catch (error) {
      const candidates = mode === 'create' ? duplicateCandidatesOf(error) : null;
      if (candidates !== null) setPending({ values, candidates });
      else setFailure(error);
    }
  });

  return (
    <Card role="region" aria-label="Formulaire de contact" className="gap-4">
      <form noValidate className="flex flex-col gap-4" onSubmit={(event) => { void submit(event); }}>
        <ContactFields control={form.control} register={form.register} errors={form.formState.errors} mode={mode} categories={categories} tags={tags} />
        {Object.keys(form.formState.errors).length > 0 ? <Alert tone="danger" title="Le formulaire contient des erreurs">Corrigez les champs signalés puis enregistrez de nouveau.</Alert> : null}
        {failure === null ? null : <ActionError title={stale ? 'Fiche modifiée entre-temps' : 'Contact non enregistré'} error={failure} />}
        {stale ? <StaleReload /> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <LinkButton href={contact ? directoryPaths.contact(contact.id) : directoryPaths.contacts} variant="ghost">Annuler</LinkButton>
          <Button type="submit" loading={form.formState.isSubmitting || create.isPending || update.isPending}>{mode === 'create' ? 'Créer le contact' : 'Enregistrer'}</Button>
        </div>
      </form>
      <ConfirmAction
        open={pending !== null}
        title="Un contact semblable existe déjà"
        description="Vérifiez que vous ne créez pas un doublon. Il n’existe pas de fusion de fiches : un doublon se corrige en archivant l’une des deux."
        extra={pending ? <DuplicateCandidates candidates={pending.candidates} /> : undefined}
        confirmLabel="Créer quand même"
        failureTitle="Contact non créé"
        run={async () => { if (pending) await save(pending.values, true); }}
        onClose={() => { setPending(null); }}
      />
    </Card>
  );
}

function StaleReload() {
  const reload = useReloadDirectory();
  return (
    <div>
      <Button variant="secondary" size="sm" onClick={reload}>Recharger la fiche</Button>
    </div>
  );
}
