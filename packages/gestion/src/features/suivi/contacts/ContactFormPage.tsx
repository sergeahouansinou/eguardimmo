'use client';

import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Button, Card, CardTitle, Checkbox, Select, Switch, TextField, Textarea } from '@eguardimmo/ui';
import { EmptyBlock, PageHeader, pushFlash, QueryState, useSourceMutation } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { BIENS } from '../shared/biens';
import { fieldErrors } from '../shared/schemas';
import type { FieldErrors } from '../shared/schemas';
import { FieldGrid, FormActions, FormLayout, Notice } from '../shared/ui';
import { CATEGORIES, categoryLabels, contactInputSchema, REACH_MESSAGE } from './schemas';
import type { Contact, ContactInput } from './schemas';
import { CONTACTS_KEY, useContacts, useContactsSource } from './source';

export function ContactFormPage({ Link, navigate, id }: ScreenProps & { id?: string }) {
  const query = useContacts();
  if (id === undefined) return <ContactForm Link={Link} navigate={navigate} contact={null} />;
  return (
    <QueryState query={query} errorTitle="Le contact n’a pas pu être chargé" loadingLabel="Chargement du contact">
      {(items) => {
        const contact = items.find((candidate) => candidate.id === id);
        if (!contact) {
          return (
            <>
              <PageHeader Link={Link} crumbs={[{ label: 'Outils' }, { label: 'Carnet de contacts', href: '/contacts' }, { label: 'Introuvable' }]} title="Contact introuvable" />
              <EmptyBlock
                title="Contact introuvable"
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/contacts">Retour au carnet</Link>
                  </Button>
                }
              >
                Il a peut-être été supprimé.
              </EmptyBlock>
            </>
          );
        }
        return <ContactForm Link={Link} navigate={navigate} contact={contact} />;
      }}
    </QueryState>
  );
}

function ContactForm({ Link, navigate, contact }: Pick<ScreenProps, 'Link' | 'navigate'> & { contact: Contact | null }) {
  const source = useContactsSource();
  const editing = contact !== null;
  const save = useSourceMutation(
    (draft: ContactInput) => (contact ? source.update(contact.id, draft) : source.create(draft)),
    [CONTACTS_KEY],
  );
  const [name, setName] = useState(contact?.name ?? '');
  const [subtitle, setSubtitle] = useState(contact?.subtitle ?? '');
  const [category, setCategory] = useState<string>(contact?.category ?? '');
  const [detail, setDetail] = useState(contact?.detail ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [email, setEmail] = useState(contact?.email ?? '');
  const [bienIds, setBienIds] = useState<readonly string[]>(contact?.bienIds ?? []);
  const [shared, setShared] = useState(contact?.shared ?? false);
  const [notes, setNotes] = useState(contact?.notes ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    setFailure(null);
    const parsed = contactInputSchema.safeParse({
      name,
      subtitle,
      category: category === '' ? undefined : category,
      detail,
      phone,
      email,
      bienIds,
      shared,
      notes,
    });
    if (!parsed.success) {
      const found = fieldErrors(parsed.error);
      if (phone.trim() === '' && email.trim() === '') found.phone ??= REACH_MESSAGE;
      setErrors(found);
      return;
    }
    setErrors({});
    save.mutate(parsed.data, {
      onSuccess: () => {
        pushFlash(editing ? `Contact « ${parsed.data.name} » modifié.` : `Contact « ${parsed.data.name} » ajouté au carnet.`);
        navigate(contact ? `/contacts/${contact.id}` : '/contacts');
      },
      onError: () => { setFailure(editing ? 'Le contact n’a pas pu être modifié. Réessayez dans un instant.' : 'Le contact n’a pas pu être créé. Réessayez dans un instant.'); },
    });
  };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={
          contact
            ? [{ label: 'Outils' }, { label: 'Carnet de contacts', href: '/contacts' }, { label: contact.name, href: `/contacts/${contact.id}` }, { label: 'Modifier' }]
            : [{ label: 'Outils' }, { label: 'Carnet de contacts', href: '/contacts' }, { label: 'Nouveau contact' }]
        }
        title={contact ? `Modifier ${contact.name}` : 'Nouveau contact'}
        description="Un contact partagé est visible par les locataires du bien."
      />
      <Notice tone="danger" message={failure} onDismiss={() => { setFailure(null); }} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        <FormLayout
          main={
            <Card>
              <CardTitle as="h2">Contact</CardTitle>
              <FieldGrid>
                <TextField label="Nom *" placeholder="Plomberie Sanvi" value={name} error={errors.name} onChange={(event) => { setName(event.target.value); }} required />
                <TextField
                  label="Interlocuteur ou précision"
                  placeholder="Rodrigue Sanvi"
                  value={subtitle}
                  error={errors.subtitle}
                  onChange={(event) => { setSubtitle(event.target.value); }}
                />
              </FieldGrid>
              <FieldGrid>
                <Select
                  label="Catégorie *"
                  placeholder="Choisir une catégorie"
                  options={CATEGORIES.map((value) => ({ value, label: categoryLabels[value] }))}
                  value={category}
                  error={errors.category}
                  onValueChange={setCategory}
                />
                <TextField label="Spécialité" placeholder="Plombier" value={detail} error={errors.detail} onChange={(event) => { setDetail(event.target.value); }} />
              </FieldGrid>
              <FieldGrid>
                <TextField
                  label="Téléphone"
                  type="tel"
                  placeholder="+33 6 12 40 18 77"
                  value={phone}
                  error={errors.phone}
                  onChange={(event) => { setPhone(event.target.value); }}
                />
                <TextField
                  label="E-mail"
                  type="email"
                  placeholder="contact@plomberie-sanvi.fr"
                  value={email}
                  error={errors.email}
                  onChange={(event) => { setEmail(event.target.value); }}
                />
              </FieldGrid>
              <Textarea
                label="Notes"
                placeholder="Intervient sous 48 h pour les urgences."
                value={notes}
                error={errors.notes}
                onChange={(event) => { setNotes(event.target.value); }}
              />
            </Card>
          }
          aside={
            <Card>
              <CardTitle as="h2">Biens et partage</CardTitle>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-body-strong text-fg">Biens concernés</legend>
                {BIENS.map((bien) => (
                  <Checkbox
                    key={bien.id}
                    label={bien.label}
                    checked={bienIds.includes(bien.id)}
                    onChange={(event) => {
                      setBienIds(event.target.checked ? [...bienIds, bien.id] : bienIds.filter((value) => value !== bien.id));
                    }}
                  />
                ))}
              </fieldset>
              <Switch label="Partager avec les locataires du bien" checked={shared} onCheckedChange={setShared} />
            </Card>
          }
        />
        <FormActions
          onCancel={() => { navigate(contact ? `/contacts/${contact.id}` : '/contacts'); }}
          submitLabel={editing ? 'Enregistrer les modifications' : 'Enregistrer le contact'}
          pending={save.isPending}
        />
      </form>
    </>
  );
}
