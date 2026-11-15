'use client';

import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Button, Card, CardTitle, Select, Switch, TextField, Textarea } from '@eguardimmo/ui';
import { EmptyBlock, nextId, PageHeader, pushFlash, QueryState, useSourceMutation } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { bienOptions } from '../shared/biens';
import { DropZone } from '../shared/DropZone';
import { pickFiles } from '../shared/files';
import type { PickedFile, Rejection } from '../shared/files';
import { PickedFiles, RejectedFiles } from '../shared/FileList';
import { fieldErrors, NONE } from '../shared/schemas';
import type { FieldErrors } from '../shared/schemas';
import { FieldGrid, FormActions, FormLayout, Notice } from '../shared/ui';
import { useIntervenantNames } from './hooks';
import { interventionInputSchema, priorityLabels, PRIORITIES } from './schemas';
import type { Intervention, InterventionInput } from './schemas';
import { INTERVENTIONS_KEY, useInterventions, useInterventionsSource } from './source';

const PHOTO_RULES = {
  extensions: ['jpg', 'jpeg', 'png'],
  mimes: ['image/jpeg', 'image/png'],
  maxBytes: 10_000_000,
  maxFiles: 10,
} as const;

export function InterventionFormPage({ Link, navigate, id }: ScreenProps & { id?: string }) {
  const query = useInterventions();
  if (id === undefined) return <InterventionForm Link={Link} navigate={navigate} item={null} />;
  return (
    <QueryState query={query} errorTitle="L’intervention n’a pas pu être chargée" loadingLabel="Chargement de l’intervention">
      {(items) => {
        const item = items.find((candidate) => candidate.id === id);
        if (!item) {
          return (
            <>
              <PageHeader Link={Link} crumbs={[{ label: 'Interventions', href: '/interventions' }, { label: 'Introuvable' }]} title="Intervention introuvable" />
              <EmptyBlock
                title="Intervention introuvable"
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/interventions">Retour aux interventions</Link>
                  </Button>
                }
              >
                Elle a peut-être été supprimée.
              </EmptyBlock>
            </>
          );
        }
        return <InterventionForm Link={Link} navigate={navigate} item={item} />;
      }}
    </QueryState>
  );
}

function InterventionForm({ Link, navigate, item }: Pick<ScreenProps, 'Link' | 'navigate'> & { item: Intervention | null }) {
  const source = useInterventionsSource();
  const editing = item !== null;
  const save = useSourceMutation(
    (draft: InterventionInput) => (item ? source.update(item.id, draft) : source.create(draft)),
    [INTERVENTIONS_KEY],
  );
  const intervenants = useIntervenantNames([item?.intervenant ?? null]);
  const [subject, setSubject] = useState(item?.subject ?? '');
  const [bienId, setBienId] = useState<string>(item?.bienId ?? '');
  const [priority, setPriority] = useState<string>(item?.priority ?? 'normale');
  const [dueDate, setDueDate] = useState(item?.dueDate ?? '');
  const [intervenant, setIntervenant] = useState(item?.intervenant ?? NONE);
  const [description, setDescription] = useState(item?.description ?? '');
  const [notifyTenant, setNotifyTenant] = useState(item?.notifyTenant ?? true);
  const [photos, setPhotos] = useState<PickedFile[]>((item?.photos ?? []).map((photo) => ({ id: nextId('fichier'), ...photo })));
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
    save.mutate(parsed.data, {
      onSuccess: () => {
        pushFlash(editing ? `Intervention « ${parsed.data.subject} » modifiée.` : `Intervention « ${parsed.data.subject} » créée.`);
        navigate(item ? `/interventions/${item.id}` : '/interventions');
      },
      onError: () => { setFailure(editing ? 'L’intervention n’a pas pu être modifiée. Réessayez dans un instant.' : 'L’intervention n’a pas pu être créée. Réessayez dans un instant.'); },
    });
  };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={
          item
            ? [{ label: 'Interventions', href: '/interventions' }, { label: item.subject, href: `/interventions/${item.id}` }, { label: 'Modifier' }]
            : [{ label: 'Interventions', href: '/interventions' }, { label: 'Nouvelle intervention' }]
        }
        title={item ? `Modifier ${item.subject}` : 'Nouvelle intervention'}
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
                  options={[{ value: NONE, label: 'À assigner' }, ...intervenants.map((value) => ({ value, label: value }))]}
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
        <FormActions
          onCancel={() => { navigate(item ? `/interventions/${item.id}` : '/interventions'); }}
          submitLabel={editing ? 'Enregistrer les modifications' : 'Créer l’intervention'}
          pending={save.isPending}
        />
      </form>
    </>
  );
}
