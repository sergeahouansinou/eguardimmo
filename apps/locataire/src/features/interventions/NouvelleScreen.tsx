'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Card, CardHeader, CardTitle, Icon, Select, Textarea, TextField } from '@eguardimmo/ui';
import { Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { FileDrop } from '@/components/FileDrop';
import { useFlash } from '@/components/flash';
import { PageHeader } from '@/components/PageHeader';
import { RadioCards } from '@/components/RadioCards';
import { useCreateIntervention } from '@/data/queries';
import { INTERVENTION_ROOMS, INTERVENTION_TYPES, URGENCIES, interventionInputSchema } from '@/data/schemas/interventions';
import type { InterventionInput } from '@/data/schemas/interventions';
import { PHOTO_RULES, checkFile } from '@/lib/files';

const MAX_PHOTOS = 6;

export function NouvelleScreen() {
  const router = useRouter();
  const show = useFlash((state) => state.show);
  const create = useCreateIntervention();
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | undefined>();
  const form = useForm<InterventionInput>({
    resolver: zodResolver(interventionInputSchema),
    defaultValues: { type: '', room: '', title: '', description: '', urgency: 'rapide', availability: '', photos: [] },
  });
  const { register, handleSubmit, formState, control, setValue } = form;
  const typeValue = useWatch({ control, name: 'type' });
  const roomValue = useWatch({ control, name: 'room' });
  const urgencyValue = useWatch({ control, name: 'urgency' });

  const changeFiles = (next: File[]) => {
    const rejected = next.map((file) => checkFile(file, PHOTO_RULES)).find((check) => !check.ok);
    if (rejected) {
      setFileError(rejected.error);
      return;
    }
    if (next.length > MAX_PHOTOS) {
      setFileError(`${String(MAX_PHOTOS)} photos au maximum.`);
      return;
    }
    setFileError(undefined);
    setFiles(next);
    setValue('photos', next.map((file) => file.name));
  };

  const submit = handleSubmit((values) => {
    create.mutate(values, {
      onSuccess: (intervention) => {
        show({
          tone: 'success',
          title: 'Signalement envoyé',
          detail: `Votre demande ${intervention.id} a été transmise à votre gestionnaire.`,
          path: `/interventions/${intervention.id}`,
        });
        router.push(`/interventions/${intervention.id}`);
      },
    });
  });

  return (
    <form onSubmit={(event) => { void submit(event); }} noValidate className="flex flex-col gap-3">
      <PageHeader
        title="Signaler un problème"
        crumbs={[{ label: 'Interventions', href: '/interventions' }, { label: 'Signaler un problème' }]}
        subtitle="Décrivez le problème, joignez des photos : le gestionnaire missionne un intervenant."
      />
      <Alert tone="warning" title="Dégât des eaux important">
        Coupez l’arrivée d’eau, puis appelez le gestionnaire au 01 00 00 00 10.
      </Alert>
      {create.isError ? (
        <Alert tone="danger" title="Le signalement n’a pas pu être envoyé">
          {create.error.message}
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-labelledby="in-probleme" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="in-probleme">Le problème</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Type de problème *"
                placeholder="Plomberie, fuite"
                value={typeValue}
                options={INTERVENTION_TYPES}
                onValueChange={(value) => { setValue('type', value, { shouldValidate: true }); }}
                error={formState.errors.type?.message}
              />
              <Select
                label="Pièce concernée *"
                placeholder="Cuisine"
                value={roomValue}
                options={INTERVENTION_ROOMS.map((room) => ({ value: room, label: room }))}
                onValueChange={(value) => { setValue('room', value, { shouldValidate: true }); }}
                error={formState.errors.room?.message}
              />
              <div className="sm:col-span-2">
                <TextField label="Titre *" placeholder="Fuite sous l'évier" {...register('title')} error={formState.errors.title?.message} />
              </div>
              <div className="sm:col-span-2">
                <Textarea
                  label="Description *"
                  placeholder="De l'eau coule du siphon sous l'évier depuis hier soir."
                  rows={4}
                  {...register('description')}
                  error={formState.errors.description?.message}
                />
              </div>
            </div>
          </Card>
          <Card role="region" aria-labelledby="in-urgence" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="in-urgence">Urgence</CardTitle>
            </CardHeader>
            <RadioCards
              legend="Urgence"
              value={urgencyValue}
              onValueChange={(value) => { setValue('urgency', value); }}
              options={URGENCIES.map((urgency) => ({ value: urgency.value, label: urgency.label, detail: urgency.detail }))}
            />
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-labelledby="in-photos" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="in-photos">Photos</CardTitle>
            </CardHeader>
            <FileDrop title="Joindre des photos" rules={PHOTO_RULES} files={files} multiple onFilesChange={changeFiles} error={fileError ?? formState.errors.photos?.message} />
          </Card>
          <Card role="region" aria-labelledby="in-acces" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="in-acces">Accès au logement</CardTitle>
            </CardHeader>
            <TextField
              label="Disponibilités"
              placeholder="En semaine, de 9 h à 12 h"
              {...register('availability')}
              error={formState.errors.availability?.message}
            />
            <p className="text-caption text-fg-subtle">Vous serez prévenu du rendez-vous avant l’intervention.</p>
          </Card>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" asChild>
          <Link href="/interventions">Annuler</Link>
        </Button>
        <Button type="submit" loading={create.isPending}>
          <Icon icon={Send} />
          Envoyer le signalement
        </Button>
      </div>
    </form>
  );
}
