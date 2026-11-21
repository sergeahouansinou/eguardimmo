'use client';

import { Alert, Badge, Button, Card, Icon } from '@eguardimmo/ui';
import { CalendarPlus, Pencil, XCircle } from 'lucide-react';
import { useState } from 'react';
import { DescriptionList, LinkButton, PageHeader, useGestionNavigation, useNotify } from '../../locataires/kit';
import { links } from '../../locataires/kit/links';
import { ConfirmAction } from '../../orgapi/ConfirmAction';
import { QueryState } from '../../orgapi/QueryState';
import { useOrgLeaseChoices, useOrgMembers, useOrgPermission, useOrgPropertyChoices, useOrgTimezone, useOrgUnitChoices, usePartyChoice } from '../../orgapi/hooks';
import { agendaPaths } from '../agendaPaths';
import { useCancelEvent, usePlanningEvent } from '../hooks';
import { REMINDER_LABELS, KIND_LABELS } from './labels';
import type { PlanningEvent } from '../model';
import { eventStartLabel, eventZoneNote, recurrenceLabel } from './eventText';
import { downloadIcs } from './ics';
import { useReload } from './useReload';

const NOT_FOUND = { title: 'Événement introuvable', description: 'Cet événement n’existe plus ou n’appartient pas à votre organisation.', backHref: agendaPaths.agenda, backLabel: 'Retour à l’agenda' };

export function PlanningEventDetailPage({ id }: { id: string }) {
  const query = usePlanningEvent(id);
  const timezone = useOrgTimezone();
  const reload = useReload();
  const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Agenda', href: agendaPaths.agenda }, { label: 'Événement' }];
  if (query.data === undefined || timezone.data === undefined) {
    return (
      <>
        <PageHeader crumbs={crumbs} title="Événement" />
        <QueryState query={query.data === undefined ? query : timezone} label="Chargement de l’événement" title="Impossible de charger l’événement" notFound={NOT_FOUND} onRetry={reload} />
      </>
    );
  }
  return <EventDetail event={query.data} timeZone={timezone.data} crumbs={crumbs} />;
}

function PartyLine({ id }: { id: string }) {
  const party = usePartyChoice(id);
  return <>{party.data?.name ?? 'Contact'}</>;
}

function Participants({ event }: { event: PlanningEvent }) {
  const members = useOrgMembers();
  if (event.attendees.length === 0) return <>Aucun participant</>;
  return (
    <ul className="flex flex-col gap-0.5">
      {event.attendees.map((attendee) => (
        <li key={attendee.userId ?? attendee.partyId}>
          {attendee.userId ? (members.data?.choices.find((choice) => choice.userId === attendee.userId)?.name ?? 'Membre de l’équipe') : <PartyLine id={attendee.partyId ?? ''} />}
        </li>
      ))}
    </ul>
  );
}

function useLinkRows(event: PlanningEvent) {
  const { Link } = useGestionNavigation();
  const properties = useOrgPropertyChoices();
  const units = useOrgUnitChoices(event.propertyId);
  const leases = useOrgLeaseChoices();
  const linkClass = 'text-action-on-subtle underline underline-offset-2';
  const lines = [
    event.propertyId ? { term: 'Bien', detail: <Link href={agendaPaths.property(event.propertyId)} className={linkClass}>{properties.data?.find((property) => property.id === event.propertyId)?.name ?? 'Voir le bien'}</Link> } : null,
    event.unitId ? { term: 'Lot', detail: <Link href={agendaPaths.unit(event.unitId)} className={linkClass}>{units.data?.find((unit) => unit.id === event.unitId)?.reference ?? 'Voir le lot'}</Link> } : null,
    event.leaseId ? { term: 'Bail', detail: <Link href={agendaPaths.lease(event.leaseId)} className={linkClass}>{leases.data?.find((lease) => lease.id === event.leaseId)?.reference ?? 'Voir le bail'}</Link> } : null,
  ];
  return lines.flatMap((line) => line ?? []);
}

function EventDetail({ event, timeZone, crumbs }: { event: PlanningEvent; timeZone: string; crumbs: { label: string; href?: string }[] }) {
  const permission = useOrgPermission('planning');
  const cancel = useCancelEvent();
  const notify = useNotify();
  const [confirming, setConfirming] = useState(false);
  const cancelled = event.cancelledAt !== null;
  const zoneNote = eventZoneNote(event, timeZone);
  const linkRows = useLinkRows(event);

  return (
    <>
      <PageHeader
        crumbs={[...crumbs.slice(0, -1), { label: event.title }]}
        title={event.title}
        badges={
          <>
            <Badge tone="info">{KIND_LABELS[event.kind]}</Badge>
            {cancelled ? <Badge tone="danger">Annulé</Badge> : null}
          </>
        }
        actions={
          <>
            {cancelled ? null : (
              <Button variant="secondary" onClick={() => { downloadIcs(event, timeZone); }}>
                <Icon icon={CalendarPlus} />
                Ajouter à mon calendrier
              </Button>
            )}
            {permission.write && !cancelled ? <LinkButton href={agendaPaths.editEvent(event.id)} icon={Pencil}>Modifier</LinkButton> : null}
            {permission.write && !cancelled ? (
              <Button variant="danger" onClick={() => { setConfirming(true); }}>
                <Icon icon={XCircle} />
                Annuler l’événement
              </Button>
            ) : null}
          </>
        }
      />
      {cancelled ? <Alert tone="warning" title="Événement annulé">Cet événement n’apparaît plus dans l’agenda et ne se modifie plus.</Alert> : null}
      <Card role="region" aria-label="Détail de l’événement" className="gap-4">
        <DescriptionList
          termWidth="140px"
          items={[
            { term: 'Début', detail: <>{eventStartLabel(event, timeZone)}{zoneNote ? <span className="block text-caption text-fg-subtle">{zoneNote}</span> : null}</> },
            { term: 'Récurrence', detail: recurrenceLabel(event) },
            { term: 'Rappel', detail: event.reminderOffsetMinutes === null ? 'Aucun rappel' : REMINDER_LABELS[event.reminderOffsetMinutes] },
            ...linkRows,
            { term: 'Participants', detail: <Participants event={event} /> },
            { term: 'Notes', detail: event.notes ? <p className="whitespace-pre-wrap">{event.notes}</p> : 'Aucune note' },
          ]}
        />
      </Card>
      <ConfirmAction
        open={confirming}
        tone="danger"
        title="Annuler cet événement ?"
        description={event.recurrence === 'none' ? 'L’événement disparaîtra de l’agenda. Cette action est définitive.' : 'Toute la série disparaîtra de l’agenda, y compris les occurrences à venir. Cette action est définitive.'}
        confirmLabel="Annuler l’événement"
        failureTitle="Événement non annulé"
        run={async () => {
          await cancel.mutateAsync(event.id);
          notify({ title: 'Événement annulé' });
        }}
        onClose={() => { setConfirming(false); }}
      />
    </>
  );
}
