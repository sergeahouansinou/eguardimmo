'use client';

import { Camera, X } from 'lucide-react';
import { Alert, Badge, Button, IconButton, ProgressBar, Select, TextField } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { useState } from 'react';
import { useSaveEdlSurvey } from './hooks';
import { SURVEY_STATES, emptySurvey, surveyInputSchema, surveyStateLabel } from './schemas';
import type { Edl, SurveyElement, SurveyRoom, SurveyState } from './schemas';
import { RoomNav } from './EdlRoomNav';
import { SectionCard, errorMessage, useNotify } from '../locataires/kit';
import { slugify } from '../locataires/kit/ids';

const stateTone: Record<SurveyState, BadgeTone> = { non_controle: 'neutral', neuf: 'success', bon: 'success', usage: 'info', degrade: 'warning', absent: 'danger' };
const asState = (value: string): SurveyState => SURVEY_STATES.find((entry) => entry === value) ?? 'non_controle';

export function mergeSurvey(edl: Pick<Edl, 'rooms' | 'survey'>): SurveyRoom[] {
  return edl.rooms.map((room) => edl.survey.find((entry) => entry.room === room) ?? emptySurvey([room])[0] ?? { room, elements: [] });
}

export function SurveyReadOnly({ survey }: { survey: readonly SurveyRoom[] }) {
  const [selected, setSelected] = useState(survey[0]?.room ?? '');
  const room = survey.find((entry) => entry.room === selected) ?? survey[0];
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:gap-5">
      <RoomNav rooms={survey} selected={room?.room ?? ''} onSelect={setSelected} />
      {room ? (
        <section aria-label={`Relevé, ${room.room}`} className="min-w-0 flex-1">
          <ul>
            {room.elements.map((element) => (
              <li key={element.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line py-2 first:border-t-0">
                <span className="w-40 text-body-strong text-fg">{element.label}</span>
                <Badge tone={stateTone[element.state]}>{surveyStateLabel[element.state]}</Badge>
                <span className="min-w-0 flex-1 text-body text-fg-muted">{element.note}</span>
                {element.photos.length > 0 ? <span className="text-caption text-fg-subtle">{`${String(element.photos.length)} photo${element.photos.length > 1 ? 's' : ''}`}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function EdlSurveyEditor({ edl }: { edl: Edl }) {
  const save = useSaveEdlSurvey(edl.id);
  const notify = useNotify();
  const [draft, setDraft] = useState<SurveyRoom[]>(() => mergeSurvey(edl));
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(() => draft[0]?.room ?? '');

  const patch = (room: string, elementId: string, changes: Partial<SurveyElement>) => {
    setDraft((current) => current.map((entry) => (entry.room === room ? { ...entry, elements: entry.elements.map((element) => (element.id === elementId ? { ...element, ...changes } : element)) } : entry)));
    setError(null);
  };

  const addPhoto = (room: string, element: SurveyElement) => {
    patch(room, element.id, { photos: [...element.photos, `${slugify(room)}-${element.id}-${String(element.photos.length + 1)}.jpg`] });
  };

  const index = Math.max(0, draft.findIndex((entry) => entry.room === selected));
  const room = draft[index];
  const next = draft[index + 1];
  const total = draft.reduce((sum, entry) => sum + entry.elements.length, 0);
  const done = draft.reduce((sum, entry) => sum + entry.elements.filter((element) => element.state !== 'non_controle').length, 0);

  const submit = async () => {
    const parsed = surveyInputSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Relevé invalide.');
      return;
    }
    try {
      await save.mutateAsync(parsed.data);
      setError(null);
      notify({ title: 'Relevé enregistré', description: `${String(done)} élément${done > 1 ? 's' : ''} contrôlé${done > 1 ? 's' : ''} sur ${String(total)}.` });
    } catch (failure) {
      notify({ tone: 'danger', title: 'Enregistrement impossible', description: errorMessage(failure) });
    }
  };

  return (
    <SectionCard id="edl-releve" title="Relevé pièce par pièce" aside={<Badge tone={done === total ? 'success' : 'info'}>{`${String(done)} sur ${String(total)} contrôlés`}</Badge>}>
      <ProgressBar value={total === 0 ? 0 : (done / total) * 100} label={`${String(done)} éléments contrôlés sur ${String(total)}`} />
      {error ? <Alert tone="danger" title="Relevé incomplet">{error}</Alert> : null}
      <div className="flex flex-col gap-3 lg:flex-row lg:gap-5">
        <RoomNav rooms={draft} selected={room?.room ?? ''} onSelect={setSelected} />
        {room ? (
          <section aria-label={`Relevé, ${room.room}`} className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-1">
              <h3 className="text-block-title text-fg">{room.room}</h3>
              <p className="text-caption text-fg-subtle">Une dégradation ou une absence demande une observation ou une photo.</p>
            </div>
            <ul>
              {room.elements.map((element) => (
                <li key={element.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1.5 border-t border-line py-2 md:grid-cols-[130px_168px_minmax(0,1fr)_auto]">
                  <span className="col-span-2 text-body-strong text-fg md:col-span-1 md:pt-1.5">{element.label}</span>
                  <div className="col-span-2 md:col-span-1">
                    <Select
                      label={`${room.room}, ${element.label}, état`}
                      hideLabel
                      placeholder="État"
                      value={element.state}
                      onValueChange={(value) => { patch(room.room, element.id, { state: asState(value) }); }}
                      options={SURVEY_STATES.map((state) => ({ value: state, label: surveyStateLabel[state] }))}
                    />
                  </div>
                  <TextField
                    label={`${room.room}, ${element.label}, observations`}
                    hideLabel
                    placeholder="Ex. Trace d’humidité près de la fenêtre"
                    value={element.note}
                    maxLength={300}
                    onChange={(event) => { patch(room.room, element.id, { note: event.target.value }); }}
                  />
                  <IconButton variant="secondary" label={`Ajouter une photo, ${room.room}, ${element.label}`} icon={Camera} className="mt-0.5" onClick={() => { addPhoto(room.room, element); }} />
                  {element.photos.length > 0 ? (
                    <div className="col-span-2 flex flex-wrap items-center gap-1.5 md:col-span-2 md:col-start-3">
                      {element.photos.map((photo) => (
                        <span key={photo} className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 text-caption text-fg-muted">
                          {photo}
                          <IconButton
                            label={`Retirer la photo ${photo}`}
                            icon={X}
                            size="xs"
                            onClick={() => { patch(room.room, element.id, { photos: element.photos.filter((entry) => entry !== photo) }); }}
                          />
                        </span>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <div className="sticky bottom-0 -mx-4 -mb-4 flex items-center justify-between gap-2 rounded-b-lg border-t border-line bg-surface py-3 pr-16 pl-4">
        {next ? <Button variant="secondary" onClick={() => { setSelected(next.room); }}>{`Pièce suivante : ${next.room}`}</Button> : <span />}
        <Button loading={save.isPending} onClick={() => { void submit(); }}>Enregistrer le relevé</Button>
      </div>
    </SectionCard>
  );
}
