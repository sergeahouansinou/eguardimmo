'use client';

import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Card, CardTitle, Select, Switch, TextField, Textarea } from '@eguardimmo/ui';
import { PageHeader, pushFlash, useSourceMutation } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { bienOptions, INTERVENANTS } from '../shared/biens';
import { DropZone } from '../shared/DropZone';
import { pickFiles } from '../shared/files';
import type { PickedFile, Rejection } from '../shared/files';
import { PickedFiles, RejectedFiles } from '../shared/FileList';
import { fieldErrors, NONE } from '../shared/schemas';
import type { FieldErrors } from '../shared/schemas';
import { FieldGrid, FormActions, FormLayout, Notice } from '../shared/ui';
import { interventionInputSchema, priorityLabels, PRIORITIES } from './schemas';
import { INTERVENTIONS_KEY, useInterventionsSource } from './source';

const PHOTO_RULES = {
  extensions: ['jpg', 'jpeg', 'png'],
  mimes: ['image/jpeg', 'image/png'],
  maxBytes: 10_000_000,
  maxFiles: 10,
} as const;

export function InterventionFormPage({ Link, navigate }: ScreenProps) {
  const source = useInterventionsSource();
  const create = useSourceMutation(source.create, [INTERVENTIONS_KEY]);
  const [subject, setSubject] = useState('');
  const [bienId, setBienId] = useState('');
  const [priority, setPriority] = useState('normale');
  const [dueDate, setDueDate] = useState('');
  const [intervenant, setIntervenant] = useState(NONE);
  const [description, setDescription] = useState('');
  const [notifyTenant, setNotifyTenant] = useState(true);
  const [photos, setPhotos] = useState<PickedFile[]>([]);
  const [rejected, setRejected] = useState<Rejection[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);

  const addPhotos = (files: File[]) => {
    const result = pickFiles(files, photos, PHOTO_RULES, 'JPG ou PNG');
    setPhotos([...photos, ...result.accepted]);
    setRejected(result.rejected);
  };

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    setFailure(null);
    const parsed = interventionInputSchema.safeParse({
      subject,
      bienId: bienId === '' ? undefined : bienId,
      priority: priority === '' ? undefined : priority,
      dueDate: dueDate === '' ? null : dueDate,
      intervenant: intervenant === NONE ? null : intervenant,
      description,
      notifyTenant,
      photos: photos.map((photo) => ({ name: photo.name, sizeBytes: photo.sizeBytes })),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    create.mutate(parsed.data, {
      onSuccess: () => {
        pushFlash(`Intervention « ${parsed.data.subject} » créée.`);
        navigate('/interventions');
      },
      onError: () => { setFailure('L’intervention n’a pas pu être créée. Réessayez dans un instant.'); },
    });
  };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Interventions', href: '/interventions' }, { label: 'Nouvelle intervention' }]}
        title="Nouvelle intervention"
        description="Une intervention se rattache à un bien. Le locataire est prévenu à la planification."
      />
      <Notice tone="danger" message={failure} onDismiss={() => { setFailure(null); }} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        <FormLayout
          main={
            <Card>
              <CardTitle as="h2">Intervention</CardTitle>
              <TextField
                label="Sujet *"
                placeholder="Fuite sous évier"
                value={subject}
                error={errors.subject}
                onChange={(event) => { setSubject(event.target.value); }}
                required
              />
              <FieldGrid>
                <Select
                  label="Bien *"
                  placeholder="Choisir un bien"
                  options={bienOptions()}
                  value={bienId}
                  error={errors.bienId}
                  onValueChange={setBienId}
                />
                <Select
                  label="Priorité *"
                  placeholder="Choisir une priorité"
                  options={PRIORITIES.map((value) => ({ value, label: priorityLabels[value] }))}
                  value={priority}
                  error={errors.priority}
                  onValueChange={setPriority}
                />
              </FieldGrid>
              <FieldGrid>
                <TextField
                  label="Échéance"
                  type="date"
                  placeholder="AAAA-MM-JJ"
                  value={dueDate}
                  error={errors.dueDate}
                  onChange={(event) => { setDueDate(event.target.value); }}
                />
                <Select
                  label="Intervenant"
                  placeholder="À assigner"
                  options={[{ value: NONE, label: 'À assigner' }, ...INTERVENANTS.map((value) => ({ value, label: value }))]}
                  value={intervenant}
                  error={errors.intervenant}
                  onValueChange={setIntervenant}
                />
              </FieldGrid>
              <Textarea
                label="Description"
                placeholder="Fuite sous le lavabo de la cuisine, la cuvette est humide."
                value={description}
                error={errors.description}
                onChange={(event) => { setDescription(event.target.value); }}
              />
              <Switch label="Prévenir le locataire par e-mail" checked={notifyTenant} onCheckedChange={setNotifyTenant} />
            </Card>
          }
          aside={
            <Card>
              <CardTitle as="h2">Photos</CardTitle>
              <DropZone
                title="Ajouter des photos"
                hint="JPG ou PNG, 10 Mo au maximum"
                buttonLabel="Choisir des fichiers"
                inputLabel="Choisir des photos"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onFiles={addPhotos}
              />
              <RejectedFiles rejected={rejected} />
              <PickedFiles
                files={photos}
                onRemove={(id) => { setPhotos(photos.filter((photo) => photo.id !== id)); }}
              />
              {errors.photos ? <p className="text-caption text-fg-danger">{errors.photos}</p> : null}
            </Card>
          }
        />
        <FormActions onCancel={() => { navigate('/interventions'); }} submitLabel="Créer l’intervention" pending={create.isPending} />
      </form>
    </>
  );
}
