'use client';

import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Card, CardTitle, Select, TextField } from '@eguardimmo/ui';
import { DEMO_TODAY, PageHeader, pushFlash, useSourceMutation } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { ASSIGNEES, bienOptions } from '../shared/biens';
import { fieldErrors, NONE } from '../shared/schemas';
import type { FieldErrors } from '../shared/schemas';
import { FieldGrid, FormActions, FormLayout, Notice } from '../shared/ui';
import { CHANNELS, channelLabels, taskInputSchema } from './schemas';
import { TASKS_KEY, useTasksSource } from './source';

const DELAYS = [0, 1, 2, 7, 15, 30] as const;
const delayLabel = (days: number) => (days === 0 ? 'Le jour même' : `${String(days)} jour${days > 1 ? 's' : ''} avant`);

export function TacheFormPage({ Link, navigate }: ScreenProps) {
  const source = useTasksSource();
  const create = useSourceMutation(source.create, [TASKS_KEY]);
  const [title, setTitle] = useState('');
  const [bienId, setBienId] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState(DEMO_TODAY);
  const [channel, setChannel] = useState<string>('email');
  const [delay, setDelay] = useState('7');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    setFailure(null);
    const parsed = taskInputSchema.safeParse({
      title,
      bienId: bienId === '' ? undefined : bienId,
      assignee: assignee === '' ? undefined : assignee,
      dueDate,
      reminder: channel === NONE ? null : { channel, daysBefore: Number(delay) },
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    create.mutate(parsed.data, {
      onSuccess: () => {
        pushFlash(`Tâche « ${parsed.data.title} » créée.`);
        navigate('/taches');
      },
      onError: () => { setFailure('La tâche n’a pas pu être créée. Réessayez dans un instant.'); },
    });
  };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Suivi' }, { label: 'Tâches et rappels', href: '/taches' }, { label: 'Nouvelle tâche' }]}
        title="Nouvelle tâche"
        description="Une tâche a une échéance et peut déclencher un rappel avant cette date."
      />
      <Notice tone="danger" message={failure} onDismiss={() => { setFailure(null); }} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        <FormLayout
          main={
            <Card>
              <CardTitle as="h2">Tâche</CardTitle>
              <TextField
                label="Sujet *"
                placeholder="Attestation d'assurance à demander"
                value={title}
                error={errors.title}
                onChange={(event) => { setTitle(event.target.value); }}
                required
              />
              <FieldGrid>
                <Select label="Bien *" placeholder="Choisir un bien" options={bienOptions('short')} value={bienId} error={errors.bienId} onValueChange={setBienId} />
                <Select
                  label="Assignée à *"
                  placeholder="Choisir une personne"
                  options={ASSIGNEES.map((value) => ({ value, label: value }))}
                  value={assignee}
                  error={errors.assignee}
                  onValueChange={setAssignee}
                />
              </FieldGrid>
              <TextField
                label="Échéance *"
                type="date"
                placeholder="AAAA-MM-JJ"
                value={dueDate}
                error={errors.dueDate}
                onChange={(event) => { setDueDate(event.target.value); }}
              />
            </Card>
          }
          aside={
            <Card>
              <CardTitle as="h2">Rappel</CardTitle>
              <Select
                label="Canal du rappel"
                placeholder="Choisir un canal"
                options={[{ value: NONE, label: 'Aucun rappel' }, ...CHANNELS.map((value) => ({ value, label: channelLabels[value] }))]}
                value={channel}
                onValueChange={setChannel}
              />
              <Select
                label="Délai"
                placeholder="Choisir un délai"
                options={DELAYS.map((value) => ({ value: String(value), label: delayLabel(value) }))}
                value={delay}
                disabled={channel === NONE}
                onValueChange={setDelay}
              />
            </Card>
          }
        />
        <FormActions onCancel={() => { navigate('/taches'); }} submitLabel="Créer la tâche" pending={create.isPending} />
      </form>
    </>
  );
}
