'use client';

import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Card, CardTitle, Select, Switch, TextField } from '@eguardimmo/ui';
import { PageHeader, pushFlash, useSourceMutation } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { bienOptions } from '../shared/biens';
import { fieldErrors, NONE } from '../shared/schemas';
import type { FieldErrors } from '../shared/schemas';
import { FieldGrid, FormActions, FormLayout, Notice } from '../shared/ui';
import { CATEGORIES, categoryLabels, contactInputSchema, REACH_MESSAGE } from './schemas';
import { CONTACTS_KEY, useContactsSource } from './source';

export function ContactFormPage({ Link, navigate }: ScreenProps) {
  const source = useContactsSource();
  const create = useSourceMutation(source.create, [CONTACTS_KEY]);
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState('');
  const [detail, setDetail] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [bienId, setBienId] = useState(NONE);
  const [shared, setShared] = useState(false);
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
      bienIds: bienId === NONE ? [] : [bienId],
      shared,
    });
    if (!parsed.success) {
      const found = fieldErrors(parsed.error);
      if (phone.trim() === '' && email.trim() === '') found.phone ??= REACH_MESSAGE;
      setErrors(found);
      return;
    }
    setErrors({});
    create.mutate(parsed.data, {
      onSuccess: () => {
        pushFlash(`Contact « ${parsed.data.name} » ajouté au carnet.`);
        navigate('/contacts');
      },
      onError: () => { setFailure('Le contact n’a pas pu être créé. Réessayez dans un instant.'); },
    });
  };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Outils' }, { label: 'Carnet de contacts', href: '/contacts' }, { label: 'Nouveau contact' }]}
        title="Nouveau contact"
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
            </Card>
          }
          aside={
            <Card>
              <CardTitle as="h2">Biens et partage</CardTitle>
              <Select
                label="Bien concerné"
                placeholder="Aucun bien"
                options={[{ value: NONE, label: 'Aucun bien' }, ...bienOptions()]}
                value={bienId}
                onValueChange={setBienId}
              />
              <Switch label="Partager avec les locataires du bien" checked={shared} onCheckedChange={setShared} />
            </Card>
          }
        />
        <FormActions onCancel={() => { navigate('/contacts'); }} submitLabel="Enregistrer le contact" pending={create.isPending} />
      </form>
    </>
  );
}
