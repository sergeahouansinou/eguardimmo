'use client';

import { Lock } from 'lucide-react';
import { useState } from 'react';
import { Button, Icon } from '@eguardimmo/ui';
import { ErrorBlock, LoadingBlock } from '../../../components/parts';
import type { AccessScope } from '../../access/model';
import { consoleErrorMessage, isAccessRequired } from '../api/errors';
import { scopeReadable } from '../copy';
import { coversScope } from '../model';
import type { ConsoleGrant, OrganizationMember, OrganizationSettings } from '../model';
import { useOrganizationSettings, useOrganizationTeam } from '../queries';

const ROLE_LABEL: Readonly<Record<string, string>> = { owner: 'Propriétaire', admin: 'Administrateur', manager: 'Gestionnaire', accountant: 'Comptable' };

function AccessRequired({ detail }: { detail: string }) {
  return (
    <p role="status" className="flex items-start gap-1.5 rounded-md border border-dashed border-line-control bg-muted px-3 py-2 text-caption text-fg-muted">
      <Icon icon={Lock} size={14} className="mt-0.5 shrink-0" />
      <span>{detail}</span>
    </p>
  );
}

const REQUIRED_TEXT = 'Accès requis : demandez l’accès de l’organisation, puis attendez son accord, pour consulter ces informations.';

function TeamList({ members }: { members: readonly OrganizationMember[] }) {
  if (members.length === 0) return <p className="text-body text-fg-muted">Aucun membre actif.</p>;
  return (
    <ul aria-label="Membres de l’équipe" className="flex flex-col divide-y divide-line rounded-md border border-line">
      {members.map((member, index) => (
        <li key={`${member.firstName}-${member.lastName}-${String(index)}`} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-1.5 text-body">
          <span className="break-words">{`${member.firstName} ${member.lastName}`.trim()}</span>
          <span className="text-caption text-fg-muted">{ROLE_LABEL[member.role] ?? member.role}</span>
        </li>
      ))}
    </ul>
  );
}

function SettingsList({ settings }: { settings: OrganizationSettings }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body">
      <dt className="text-fg-muted">Nom</dt>
      <dd className="break-words">{settings.name}</dd>
      <dt className="text-fg-muted">Pays</dt>
      <dd>{settings.country}</dd>
      <dt className="text-fg-muted">Devise</dt>
      <dd>{settings.currency}</dd>
    </dl>
  );
}

interface ReadBlockProps {
  scope: AccessScope;
  title: string;
  action: string;
  covered: boolean;
  live: boolean;
  state: { isPending: boolean; isError: boolean; error: unknown; refetch: () => void };
  requested: boolean;
  onRequest: () => void;
  children: React.ReactNode;
}

function ReadBlock({ scope, title, action, covered, live, state, requested, onRequest, children }: ReadBlockProps) {
  let body;
  if (!live) body = <AccessRequired detail={REQUIRED_TEXT} />;
  else if (!covered) body = <AccessRequired detail={`Cet accès ne couvre pas le périmètre « ${scopeReadable[scope]} » : demandez-le à l’organisation.`} />;
  else if (!requested) {
    body = (
      <div>
        <Button size="sm" variant="secondary" onClick={onRequest}>
          {action}
        </Button>
      </div>
    );
  } else if (state.isPending) body = <LoadingBlock label={`Chargement : ${title.toLowerCase()}`} />;
  else if (state.isError) {
    body = isAccessRequired(state.error) ? (
      <AccessRequired detail={REQUIRED_TEXT} />
    ) : (
      <ErrorBlock message={consoleErrorMessage(state.error)} onRetry={state.refetch} />
    );
  } else body = children;
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2">
      <h3 className="text-body font-semibold text-fg">{title}</h3>
      {body}
    </section>
  );
}

export function OrganizationReads({ organizationId, liveGrants }: { organizationId: string; liveGrants: readonly ConsoleGrant[] }) {
  const live = liveGrants.length > 0;
  const teamCovered = live && coversScope(liveGrants, 'team');
  const settingsCovered = live && coversScope(liveGrants, 'settings');
  const [teamRequested, setTeamRequested] = useState(false);
  const [settingsRequested, setSettingsRequested] = useState(false);
  const team = useOrganizationTeam(organizationId, teamRequested && teamCovered);
  const settings = useOrganizationSettings(organizationId, settingsRequested && settingsCovered);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-caption text-fg-muted">Chaque lecture est journalisée. Les lectures sont à la demande : aucune n’est répétée automatiquement.</p>
      <ReadBlock
        scope="team"
        title="Équipe de l’organisation"
        action="Consulter l’équipe"
        covered={teamCovered}
        live={live}
        state={{ isPending: team.isPending, isError: team.isError, error: team.error, refetch: () => { void team.refetch(); } }}
        requested={teamRequested}
        onRequest={() => { setTeamRequested(true); }}
      >
        <TeamList members={team.data ?? []} />
      </ReadBlock>
      <ReadBlock
        scope="settings"
        title="Réglages de l’organisation"
        action="Consulter les réglages"
        covered={settingsCovered}
        live={live}
        state={{ isPending: settings.isPending, isError: settings.isError, error: settings.error, refetch: () => { void settings.refetch(); } }}
        requested={settingsRequested}
        onRequest={() => { setSettingsRequested(true); }}
      >
        {settings.data ? <SettingsList settings={settings.data} /> : null}
      </ReadBlock>
    </div>
  );
}
