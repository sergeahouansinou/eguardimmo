'use client';

import { Alert, Button, Card, Select, Textarea, TextField } from '@eguardimmo/ui';
import { useRef, useState } from 'react';
import { PageHeader, errorMessage, noticeAfterNavigation, useGestionNavigation } from '../locataires/kit';
import { links } from '../locataires/kit/links';
import { stableKey } from './dialogs/common';
import { useMaintenanceMutation, useNatureTerms, useUnitChoices } from './hooks';
import { MaintenanceGate } from './MaintenanceGate';
import { priorityBadge } from './labels';
import { PRIORITIES } from './model';
import type { Priority } from './model';
import { maintenancePaths } from './paths';

const priorityOptions = PRIORITIES.map((value) => ({ value, label: priorityBadge[value].label }));
const isPriority = (value: string): value is Priority => PRIORITIES.some((candidate) => candidate === value);

export function InterventionFormPage() {
  return (
    <MaintenanceGate>
      <InterventionForm />
    </MaintenanceGate>
  );
}

function InterventionForm() {
  const { push } = useGestionNavigation();
  const create = useMaintenanceMutation((source, input: Parameters<typeof source.create>[0]) => source.create(input));
  const units = useUnitChoices('');
  const natures = useNatureTerms();
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const [unitId, setUnitId] = useState('');
  const [natureTermId, setNatureTermId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [room, setRoom] = useState('');
  const [availability, setAvailability] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async () => {
    setFailure(null);
    try {
      const signature = JSON.stringify([unitId, natureTermId, title, description, room, availability, priority]);
      const created = await create.mutateAsync({ idempotencyKey: stableKey(attempt, signature), unitId, natureTermId, title, description, room, availability, priority });
      noticeAfterNavigation({ title: 'Intervention créée' });
      push(maintenancePaths.intervention(created.id));
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <>
      <PageHeader crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Interventions', href: maintenancePaths.interventions }, { label: 'Nouvelle intervention' }]} title="Nouvelle intervention" subtitle="Le mandat de gestion du lot est retrouvé automatiquement." />
      <Card className="max-w-[720px] gap-3">
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Select label="Lot concerné *" placeholder="Choisir un lot" searchable searchPlaceholder="Rechercher un lot" value={unitId} onValueChange={setUnitId} options={(units.data ?? []).map((unit) => ({ value: unit.id, label: unit.label }))} />
          <Select label="Nature *" placeholder="Choisir une nature" value={natureTermId} onValueChange={setNatureTermId} options={(natures.data ?? []).map((term) => ({ value: term.id, label: term.label }))} />
          <TextField label="Titre *" placeholder="Ex. Fuite sous l’évier" maxLength={120} value={title} onChange={(event) => { setTitle(event.target.value); }} />
          <Textarea label="Description *" placeholder="Décrivez le problème constaté" maxLength={1000} rows={4} value={description} onChange={(event) => { setDescription(event.target.value); }} />
          <TextField label="Pièce concernée" placeholder="Ex. Cuisine" maxLength={80} value={room} onChange={(event) => { setRoom(event.target.value); }} />
          <TextField label="Disponibilités du locataire" placeholder="Ex. Soirs après 18 h" maxLength={200} value={availability} onChange={(event) => { setAvailability(event.target.value); }} />
          <Select label="Priorité *" placeholder="Choisir une priorité" value={priority} onValueChange={(value) => { if (isPriority(value)) setPriority(value); }} options={priorityOptions} />
          {failure ? <Alert tone="danger" title="Intervention non créée">{failure}</Alert> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => { push(maintenancePaths.interventions); }}>Retour</Button>
            <Button type="submit" loading={create.isPending}>Créer l’intervention</Button>
          </div>
        </form>
      </Card>
    </>
  );
}
