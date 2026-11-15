'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Button, Card, CardTitle, IconButton, Select, Switch, TextField, Textarea } from '@eguardimmo/ui';
import { DEMO_TODAY, PageHeader, pushFlash, useSourceMutation } from '../../outils/kit';
import type { ScreenProps } from '../../outils/kit';
import { bienOptions } from '../shared/biens';
import { formatFrDate } from '../shared/dates';
import { fieldErrors, NONE } from '../shared/schemas';
import type { FieldErrors } from '../shared/schemas';
import { FieldGrid, FormActions, FormLayout, Notice } from '../shared/ui';
import { EVENT_KINDS, eventInputSchema, kindLabels, RECURRENCES, recurrenceLabels } from './schemas';
import { EVENTS_KEY, useAgendaSource } from './source';

export function EvenementFormPage({ Link, navigate }: ScreenProps) {
  const source = useAgendaSource();
  const create = useSourceMutation(source.createEvent, [EVENTS_KEY]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('visite');
  const [date, setDate] = useState(DEMO_TODAY);
  const [time, setTime] = useState('');
  const [bienId, setBienId] = useState(NONE);
  const [recurrence, setRecurrence] = useState('aucune');
  const [invitees, setInvitees] = useState<string[]>([]);
  const [invitee, setInvitee] = useState('');
  const [notes, setNotes] = useState('');
  const [reminder, setReminder] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);

  const addInvitee = () => {
    const name = invitee.trim();
    if (name === '') return;
    if (!invitees.includes(name)) setInvitees([...invitees, name]);
    setInvitee('');
  };

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    setFailure(null);
    const pending = invitee.trim();
    const parsed = eventInputSchema.safeParse({
      title,
      kind,
      date,
      time: time === '' ? null : time,
      bienId: bienId === NONE ? null : bienId,
      recurrence,
      invitees: pending === '' || invitees.includes(pending) ? invitees : [...invitees, pending],
      notes,
      reminder,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    create.mutate(parsed.data, {
      onSuccess: () => {
        pushFlash(`Événement « ${parsed.data.title} » enregistré pour le ${formatFrDate(parsed.data.date)}.`);
        navigate('/agenda');
      },
      onError: () => { setFailure('L’événement n’a pas pu être enregistré. Réessayez dans un instant.'); },
    });
  };

  return (
    <>
      <PageHeader
        Link={Link}
        crumbs={[{ label: 'Agenda', href: '/agenda' }, { label: 'Nouvel événement' }]}
        title="Nouvel événement"
        description="Un événement peut être récurrent. Il apparaît dans l’agenda et dans le lien iCal."
      />
      <Notice tone="danger" message={failure} onDismiss={() => { setFailure(null); }} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-3">
        <FormLayout
          main={
            <Card>
              <CardTitle as="h2">Événement</CardTitle>
              <TextField
                label="Titre *"
                placeholder="Visite de l'appartement B3"
                value={title}
                error={errors.title}
                onChange={(event) => { setTitle(event.target.value); }}
                required
              />
              <FieldGrid columns={3}>
                <Select
                  label="Type"
                  placeholder="Choisir un type"
                  options={EVENT_KINDS.map((value) => ({ value, label: kindLabels[value] }))}
                  value={kind}
                  error={errors.kind}
                  onValueChange={setKind}
                />
                <TextField label="Date *" type="date" placeholder="AAAA-MM-JJ" value={date} error={errors.date} onChange={(event) => { setDate(event.target.value); }} />
                <TextField label="Heure" type="time" placeholder="15:30" value={time} error={errors.time} onChange={(event) => { setTime(event.target.value); }} />
              </FieldGrid>
              <FieldGrid>
                <Select
                  label="Bien"
                  placeholder="Aucun bien"
                  options={[{ value: NONE, label: 'Aucun bien' }, ...bienOptions()]}
                  value={bienId}
                  onValueChange={setBienId}
                />
                <Select
                  label="Récurrence"
                  placeholder="Choisir une récurrence"
                  options={RECURRENCES.map((value) => ({ value, label: recurrenceLabels[value] }))}
                  value={recurrence}
                  onValueChange={setRecurrence}
                />
              </FieldGrid>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <TextField
                      label="Personnes invitées"
                      placeholder="Léa Martin"
                      value={invitee}
                      error={errors.invitees}
                      onChange={(event) => { setInvitee(event.target.value); }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        addInvitee();
                      }}
                    />
                  </div>
                  <Button variant="secondary" onClick={addInvitee}>Ajouter</Button>
                </div>
                {invitees.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Personnes invitées ajoutées">
                    {invitees.map((name) => (
                      <li key={name} className="inline-flex h-6 items-center gap-1 rounded-sm bg-muted pr-0.5 pl-2 text-caption font-medium text-fg">
                        {name}
                        <IconButton label={`Retirer ${name}`} icon={X} size="xs" onClick={() => { setInvitees(invitees.filter((item) => item !== name)); }} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <Textarea
                label="Notes"
                placeholder="Apporter le dossier de présentation."
                value={notes}
                error={errors.notes}
                onChange={(event) => { setNotes(event.target.value); }}
              />
            </Card>
          }
          aside={
            <Card>
              <CardTitle as="h2">Rappel</CardTitle>
              <Switch label="Rappel par e-mail la veille" checked={reminder} onCheckedChange={setReminder} />
            </Card>
          }
        />
        <FormActions onCancel={() => { navigate('/agenda'); }} submitLabel="Enregistrer l’événement" pending={create.isPending} />
      </form>
    </>
  );
}
