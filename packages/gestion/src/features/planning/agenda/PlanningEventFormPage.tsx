'use client';

import { Alert, Button, Card } from '@eguardimmo/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LinkButton, PageHeader, noticeAfterNavigation, useGestionNavigation } from '../../locataires/kit';
import { links } from '../../locataires/kit/links';
import { ActionError } from '../../orgapi/ActionError';
import { QueryState } from '../../orgapi/QueryState';
import { OrgApiError } from '../../orgapi/errors';
import { useOrgPermission, useOrgTimezone } from '../../orgapi/hooks';
import { todayIn } from '../../orgapi/zone';
import { agendaPaths } from '../agendaPaths';
import { PLANNING_ROOT, planningKeys, useCreateEvent, usePlanningEvent, useUpdateEvent } from '../hooks';
import type { EventInput, PlanningEvent } from '../model';
import { EventFields } from './EventFormFields';
import { isIsoDate } from './calendar';
import { useReload } from './useReload';
import { SERVER_FIELDS, emptyEventValues, eventFormSchema, valuesOfEvent } from './schemas';
import type { EventFormValues } from './schemas';

const NOT_FOUND = { title: 'Événement introuvable', description: 'Cet événement n’existe plus ou n’appartient pas à votre organisation.', backHref: agendaPaths.agenda, backLabel: 'Retour à l’agenda' };

export function PlanningEventFormPage({ id }: { id?: string }) {
  const permission = useOrgPermission('planning');
  const timezone = useOrgTimezone();
  const reloadAll = useReload();
  const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Agenda', href: agendaPaths.agenda }, { label: id ? 'Modifier l’événement' : 'Nouvel événement' }];
  const title = id ? 'Modifier l’événement' : 'Nouvel événement';
  let body;
  if (permission.pending || timezone.data === undefined) {
    body = <QueryState query={permission.pending ? { isPending: true, isError: false, error: null } : timezone} label="Chargement du formulaire" title="Impossible de préparer le formulaire" onRetry={reloadAll} />;
  } else if (!permission.write) {
    body = <Alert tone="info" title="Accès refusé">Votre rôle ne permet pas de créer ni de modifier des événements.</Alert>;
  } else {
    body = id ? <EditLoader id={id} timeZone={timezone.data} /> : <EventForm timeZone={timezone.data} event={null} />;
  }
  return (
    <>
      <PageHeader crumbs={crumbs} title={title} />
      {body}
    </>
  );
}

function EditLoader({ id, timeZone }: { id: string; timeZone: string }) {
  const query = usePlanningEvent(id);
  const reloadAll = useReload();
  if (query.data === undefined) return <QueryState query={query} label="Chargement de l’événement" title="Impossible de charger l’événement" notFound={NOT_FOUND} onRetry={reloadAll} />;
  if (query.data.cancelledAt !== null) {
    return (
      <Alert tone="info" title="Événement annulé">
        Un événement annulé ne se modifie plus. <LinkButton href={agendaPaths.event(id)} variant="link">Voir l’événement</LinkButton>
      </Alert>
    );
  }
  return <EventForm timeZone={timeZone} event={query.data} />;
}

function EventForm({ timeZone, event }: { timeZone: string; event: PlanningEvent | null }) {
  const { push, search } = useGestionNavigation();
  const client = useQueryClient();
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const dateParam = search.get('date');
  const defaults: EventFormValues = event ? valuesOfEvent(event) : emptyEventValues(isIsoDate(dateParam) ? dateParam : todayIn(timeZone));
  const form = useForm<EventFormValues, undefined, EventInput>({ resolver: zodResolver(eventFormSchema), defaultValues: defaults, mode: 'onSubmit', reValidateMode: 'onChange' });
  const [failure, setFailure] = useState<unknown>(null);
  const [outdated, setOutdated] = useState(false);

  const run = async (input: EventInput): Promise<void> => {
    setFailure(null);
    try {
      const saved = event ? await update.mutateAsync({ id: event.id, lockVersion: event.lockVersion, input }) : await create.mutateAsync(input);
      noticeAfterNavigation({ title: event ? 'Événement modifié' : 'Événement créé' });
      push(agendaPaths.event(saved.id));
    } catch (error) {
      if (error instanceof OrgApiError) {
        if (error.kind === 'stale') setOutdated(true);
        for (const [key, messages] of Object.entries(error.fieldErrors)) {
          const field = SERVER_FIELDS[key.split('.')[0] ?? ''];
          const message = messages[0];
          if (field && message) form.setError(field, { type: 'server', message });
        }
      }
      setFailure(error);
    }
  };

  const reload = () => {
    if (event === null) return;
    setOutdated(false);
    setFailure(null);
    void client.invalidateQueries({ queryKey: PLANNING_ROOT }).then(() => {
      form.reset(valuesOfEvent(client.getQueryData<PlanningEvent>(planningKeys.event(event.id)) ?? event));
    });
  };

  return (
    <Card role="region" aria-label="Formulaire d’événement" className="gap-4">
      <form noValidate className="flex flex-col gap-4" onSubmit={(submitEvent) => { void form.handleSubmit(run)(submitEvent); }}>
        <EventFields control={form.control} register={form.register} setValue={form.setValue} errors={form.formState.errors} timeZone={timeZone} />
        {Object.keys(form.formState.errors).length > 0 ? <Alert tone="danger" title="Le formulaire contient des erreurs">Corrigez les champs signalés puis enregistrez de nouveau.</Alert> : null}
        {outdated ? (
          <Alert tone="warning" title="Événement modifié entre-temps">
            <span className="flex flex-wrap items-center gap-2">
              Quelqu’un a modifié cet événement depuis votre lecture. Rechargez-le pour repartir de la dernière version : vos changements non enregistrés seront remplacés.
              <Button variant="secondary" size="sm" onClick={reload}>Recharger l’événement</Button>
            </span>
          </Alert>
        ) : failure === null ? null : (
          <ActionError title={event ? 'Événement non modifié' : 'Événement non créé'} error={failure} />
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <LinkButton href={event ? agendaPaths.event(event.id) : agendaPaths.agenda} variant="ghost">Annuler</LinkButton>
          <Button type="submit" disabled={outdated} loading={form.formState.isSubmitting}>{event ? 'Enregistrer les modifications' : 'Créer l’événement'}</Button>
        </div>
      </form>
    </Card>
  );
}
