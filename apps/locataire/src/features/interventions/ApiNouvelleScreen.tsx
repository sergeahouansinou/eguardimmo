'use client';

import { Alert, Button, Card, CardHeader, CardTitle, Icon, Select, Textarea, TextField } from '@eguardimmo/ui';
import { Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { FailureAlert } from '@/components/FailureAlert';
import { FileDrop } from '@/components/FileDrop';
import { useFlash } from '@/components/flash';
import { PageHeader } from '@/components/PageHeader';
import { RadioCards } from '@/components/RadioCards';
import { PHOTO_RULES, checkFile } from '@/lib/files';
import { INTERVENTION_WORDING } from '@/tenant/interventionErrors';
import { URGENCY_OPTIONS } from '@/tenant/interventionLabels';
import { useReportIntervention, useReportOptions } from '@/tenant/interventionQueries';
import type { ReportInput, ReportedUrgency } from '@/tenant/interventionModel';
import { MAX_PHOTOS } from './PhotosCard';

const COMMON_AREA = 'common-area';

interface Errors {
  lease?: string;
  nature?: string;
  place?: string;
  title?: string;
  description?: string;
}

export function ApiNouvelleScreen() {
  const router = useRouter();
  const show = useFlash((state) => state.show);
  const options = useReportOptions();
  const leaseList = options.data ?? [];
  const [leaseId, setLeaseId] = useState<string | null>(null);
  const activeLease = leaseList.find((lease) => lease.leaseId === leaseId) ?? (leaseList.length === 1 ? leaseList[0] : undefined);
  const activeLeaseId = activeLease?.leaseId ?? null;
  const report = useReportIntervention();
  const [natureId, setNatureId] = useState('');
  const [place, setPlace] = useState('');
  const [room, setRoom] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<ReportedUrgency>('soon');
  const [availability, setAvailability] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | undefined>();
  const [errors, setErrors] = useState<Errors>({});
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const created = useRef<string | null>(null);

  const keyFor = (signature: string): string => {
    if (attempt.current?.signature !== signature) {
      attempt.current = { signature, key: globalThis.crypto.randomUUID() };
      created.current = null;
    }
    return attempt.current.key;
  };

  const changePhotos = (next: File[]) => {
    const rejected = next.map((file) => checkFile(file, PHOTO_RULES)).find((check) => !check.ok);
    const problem = rejected?.error ?? (next.length > MAX_PHOTOS ? `${String(MAX_PHOTOS)} photos au maximum.` : undefined);
    setFileError(problem);
    if (problem === undefined) setPhotos(next);
  };

  const submit = () => {
    const next: Errors = {};
    if (activeLeaseId === null) next.lease = 'Choisissez le bail concerné.';
    if (natureId === '') next.nature = 'Choisissez un type de problème.';
    if (place === '') next.place = 'Choisissez le lieu du problème.';
    if (title.trim().length < 3) next.title = 'Le titre doit faire au moins 3 caractères.';
    if (title.trim().length > 120) next.title = 'Le titre est trop long (120 caractères au plus).';
    if (description.trim().length < 3) next.description = 'La description doit faire au moins 3 caractères.';
    if (description.trim().length > 1000) next.description = 'La description est trop longue (1000 caractères au plus).';
    setErrors(next);
    if (Object.keys(next).length > 0 || activeLeaseId === null) return;
    const input: Omit<ReportInput, 'idempotencyKey'> = {
      leaseId: activeLeaseId,
      unitId: place === COMMON_AREA ? null : place,
      commonArea: place === COMMON_AREA,
      natureTermId: natureId,
      title,
      description,
      room,
      reportedUrgency: urgency,
      availability,
    };
    const idempotencyKey = keyFor(JSON.stringify(input));
    report.mutate(
      { input: { ...input, idempotencyKey }, photos, existingId: created.current },
      {
        onSuccess: ({ id, failed }) => {
          created.current = id;
          setPhotos(failed);
          if (failed.length > 0) {
            show({ tone: 'warning', title: 'Signalement envoyé, photos manquantes', detail: `Ajoutez de nouveau : ${failed.map((file) => file.name).join(', ')}.`, path: `/interventions/${id}` });
          } else {
            show({ tone: 'success', title: 'Signalement envoyé', detail: 'Votre demande a été transmise à votre gestionnaire.', path: `/interventions/${id}` });
          }
          router.push(`/interventions/${id}`);
        },
      },
    );
  };

  const placeOptions = [
    ...(activeLease?.units.map((unit) => ({ value: unit.id, label: unit.label })) ?? []),
    ...(activeLease?.commonAreaAllowed === true ? [{ value: COMMON_AREA, label: 'Parties communes' }] : []),
  ];

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <PageHeader
        title="Signaler un problème"
        crumbs={[{ label: 'Interventions', href: '/interventions' }, { label: 'Signaler un problème' }]}
        subtitle="Décrivez le problème, joignez des photos : le gestionnaire missionne un intervenant."
      />
      <Alert tone="warning" title="Dégât des eaux ou risque immédiat">
        Coupez l’arrivée d’eau ou l’électricité si vous le pouvez, puis contactez directement votre gestionnaire ou les secours.
      </Alert>
      {report.isError ? <FailureAlert title="Le signalement n’a pas pu être envoyé" error={report.error} wording={INTERVENTION_WORDING} /> : null}
      {options.isSuccess && leaseList.length === 0 ? (
        <Alert tone="info" title="Aucun bail en cours">
          Le signalement en ligne est réservé aux baux en cours. Contactez votre gestionnaire.
        </Alert>
      ) : null}
      {options.isError ? <FailureAlert title="Les choix du formulaire n’ont pas pu être chargés" error={options.error} wording={INTERVENTION_WORDING} onRetry={() => void options.refetch()} /> : null}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-labelledby="in-probleme" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="in-probleme">Le problème</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {leaseList.length > 1 ? (
                <div className="sm:col-span-2">
                  <Select
                    label="Bail concerné *"
                    placeholder="Choisir un bail"
                    value={activeLeaseId ?? ''}
                    options={leaseList.map((lease) => ({ value: lease.leaseId, label: lease.label }))}
                    onValueChange={(value) => { setLeaseId(value); setNatureId(''); setPlace(''); }}
                    error={errors.lease}
                  />
                </div>
              ) : null}
              <Select label="Type de problème *" placeholder="Choisir un type" value={natureId} options={(activeLease?.natures ?? []).map((nature) => ({ value: nature.id, label: nature.label }))} onValueChange={setNatureId} error={errors.nature} />
              <Select label="Lieu *" placeholder="Mon logement" value={place} options={placeOptions} onValueChange={setPlace} error={errors.place} />
              <div className="sm:col-span-2">
                <TextField label="Pièce concernée" placeholder="Cuisine" maxLength={80} value={room} onChange={(event) => { setRoom(event.target.value); }} />
              </div>
              <div className="sm:col-span-2">
                <TextField label="Titre *" placeholder="Fuite sous l’évier" maxLength={120} value={title} onChange={(event) => { setTitle(event.target.value); }} error={errors.title} />
              </div>
              <div className="sm:col-span-2">
                <Textarea label="Description *" placeholder="De l’eau coule du siphon depuis hier soir." rows={4} maxLength={1000} value={description} onChange={(event) => { setDescription(event.target.value); }} error={errors.description} />
              </div>
            </div>
          </Card>
          <Card role="region" aria-labelledby="in-urgence" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="in-urgence">Urgence</CardTitle>
            </CardHeader>
            <RadioCards legend="Urgence" value={urgency} onValueChange={setUrgency} options={URGENCY_OPTIONS} />
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-labelledby="in-photos" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="in-photos">Photos</CardTitle>
            </CardHeader>
            <FileDrop title="Joindre des photos" rules={PHOTO_RULES} files={photos} multiple onFilesChange={changePhotos} error={fileError} />
          </Card>
          <Card role="region" aria-labelledby="in-acces" className="px-4 py-3">
            <CardHeader>
              <CardTitle as="h2" id="in-acces">Accès au logement</CardTitle>
            </CardHeader>
            <TextField label="Disponibilités" placeholder="En semaine, le matin" maxLength={200} value={availability} onChange={(event) => { setAvailability(event.target.value); }} />
            <p className="text-caption text-fg-subtle">Vous serez prévenu du rendez-vous avant l’intervention.</p>
          </Card>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" asChild>
          <Link href="/interventions">Annuler</Link>
        </Button>
        <Button type="submit" loading={report.isPending}>
          <Icon icon={Send} />
          Envoyer le signalement
        </Button>
      </div>
    </form>
  );
}
