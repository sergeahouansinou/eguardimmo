'use client';

import { Button, Icon, TextField } from '@eguardimmo/ui';
import { X } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useOrgMembers, usePartyChoice, usePartySearch } from '../../orgapi/hooks';
import { MAX_ATTENDEES } from '../model';
import type { EventAttendee } from '../model';

const WRAP = 'h-auto min-h-7 max-w-full py-1 text-left whitespace-normal!';

const sameAttendee = (a: EventAttendee, b: EventAttendee): boolean => (a.userId !== null && a.userId === b.userId) || (a.partyId !== null && a.partyId === b.partyId);

function PartyName({ id }: { id: string }) {
  const party = usePartyChoice(id);
  return <>{party.data?.name ?? 'Contact'}</>;
}

export function AttendeesField({ value, onChange, error }: { value: readonly EventAttendee[]; onChange: (next: EventAttendee[]) => void; error?: string }) {
  const members = useOrgMembers();
  const [search, setSearch] = useState('');
  const deferred = useDeferredValue(search);
  const parties = usePartySearch(deferred);
  const full = value.length >= MAX_ATTENDEES;
  const memberName = (userId: string): string => members.data?.choices.find((choice) => choice.userId === userId)?.name ?? 'Membre de l’équipe';
  const add = (attendee: EventAttendee) => {
    if (full || value.some((current) => sameAttendee(current, attendee))) return;
    onChange([...value, attendee]);
  };
  const availableMembers = (members.data?.choices ?? []).filter((choice) => !value.some((current) => current.userId === choice.userId));
  const availableParties = (parties.data ?? []).filter((party) => !party.archived && !value.some((current) => current.partyId === party.id));

  return (
    <fieldset className="flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="text-caption text-fg-muted">{`Participants (${String(value.length)} sur ${String(MAX_ATTENDEES)})`}</legend>
      {value.length === 0 ? <p className="text-caption text-fg-subtle">Aucun participant.</p> : null}
      <ul className="flex flex-wrap gap-2">
        {value.map((attendee) => {
          const name = attendee.userId ? memberName(attendee.userId) : null;
          return (
            <li key={attendee.userId ?? attendee.partyId} className="inline-flex min-h-7 items-center gap-1 rounded-full bg-muted pl-2.5 pr-1 text-caption text-fg">
              <span className="[overflow-wrap:anywhere]">{name ?? <PartyName id={attendee.partyId ?? ''} />}</span>
              <button
                type="button"
                aria-label={`Retirer ${name ?? 'ce contact'} des participants`}
                onClick={() => { onChange(value.filter((current) => !sameAttendee(current, attendee))); }}
                className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus"
              >
                <Icon icon={X} />
              </button>
            </li>
          );
        })}
      </ul>
      {full ? <p className="text-caption text-fg-subtle">Le nombre maximal de participants est atteint.</p> : null}
      {full ? null : (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-caption text-fg-muted">Ajouter un membre de l’équipe</span>
            <ul className="flex flex-wrap gap-1.5">
              {availableMembers.map((choice) => (
                <li key={choice.userId} className="max-w-full">
                  <Button variant="secondary" size="sm" className={WRAP} onClick={() => { add({ userId: choice.userId, partyId: null }); }}>
                    {`Ajouter ${choice.name}`}
                  </Button>
                </li>
              ))}
            </ul>
            {members.data && !members.data.complete ? <p className="text-caption text-fg-subtle">La liste des membres est incomplète : seuls les membres identifiables sont proposés.</p> : null}
          </div>
          <TextField label="Ajouter un contact" placeholder="Rechercher par nom" value={search} onChange={(event) => { setSearch(event.target.value); }} />
          {parties.isError ? <p role="alert" className="text-caption text-danger-fg">La recherche de contacts a échoué. Réessayez.</p> : null}
          <ul className="flex flex-wrap gap-1.5">
            {availableParties.map((party) => (
              <li key={party.id} className="max-w-full">
                <Button variant="secondary" size="sm" className={WRAP} onClick={() => { add({ userId: null, partyId: party.id }); }}>
                  {`Ajouter ${party.name}`}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      {error ? <p role="alert" className="text-caption text-danger-fg">{error}</p> : null}
    </fieldset>
  );
}
