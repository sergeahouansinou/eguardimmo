'use client';

import { Lock } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, CardHeader, CardTitle, Icon, Switch } from '@eguardimmo/ui';
import { FailureNotice, Loading } from '../../account/parts';
import { useRequiredNotificationsApi } from './context';
import type { NotificationAudience, NotificationChannel, PreferenceChange, PreferenceType } from './model';
import { useNotificationPreferences, useSaveNotificationPreferences } from './queries';

export interface NotificationPreferencesPanelProps {
  audience: NotificationAudience;
}

const FORM_LABELS: Readonly<Record<NotificationAudience, string>> = {
  staff: 'Préférences de notification',
  tenant: 'Préférences de notification du locataire',
  owner: 'Préférences de notification du propriétaire',
};

const WEB_CHANNELS: readonly NotificationChannel[] = ['in_app', 'email'];

const cellKey = (type: string, channel: NotificationChannel) => `${type}|${channel}`;

function groupsOf(types: PreferenceType[]): { group: string; types: PreferenceType[] }[] {
  const groups: { group: string; types: PreferenceType[] }[] = [];
  for (const type of types) {
    const existing = groups.find((entry) => entry.group === type.group);
    if (existing) existing.types.push(type);
    else groups.push({ group: type.group, types: [type] });
  }
  return groups;
}

function changesOf(types: PreferenceType[], draft: ReadonlyMap<string, boolean>): PreferenceChange[] {
  const changes: PreferenceChange[] = [];
  for (const type of types) {
    for (const channel of type.channels) {
      const wanted = draft.get(cellKey(type.type, channel.channel));
      if (wanted !== undefined && wanted !== channel.enabled && !channel.locked) {
        changes.push({ type: type.type, channel: channel.channel, enabled: wanted });
      }
    }
  }
  return changes;
}

function PreferencesForm({ types, audience }: { types: PreferenceType[]; audience: NotificationAudience }) {
  const api = useRequiredNotificationsApi();
  const save = useSaveNotificationPreferences(api);
  const [draft, setDraft] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [saved, setSaved] = useState(false);
  const changes = changesOf(types, draft);

  const toggle = (type: string, channel: NotificationChannel, enabled: boolean) => {
    setSaved(false);
    setDraft((current) => new Map(current).set(cellKey(type, channel), enabled));
  };

  const submit = () => {
    save.mutate(changes, {
      onSuccess: () => {
        setDraft(new Map());
        setSaved(true);
      },
    });
  };

  return (
    <form
      noValidate
      aria-label={FORM_LABELS[audience]}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex min-w-0 flex-col gap-3"
    >
      {groupsOf(types).map(({ group, types: entries }) => (
        <Card key={group} role="region" aria-label={group}>
          <CardHeader>
            <CardTitle as="h2">{group}</CardTitle>
          </CardHeader>
          <ul className="flex flex-col">
            {entries.map((type) => (
              <li key={type.type} className="flex flex-col gap-2 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0">
                <span className="text-body-strong font-semibold">{type.label}</span>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
                  {type.channels
                    .filter((channel) => WEB_CHANNELS.includes(channel.channel))
                    .map((channel) => {
                      const id = `pref-${type.type}-${channel.channel}`.replace(/[^\w-]/g, '-');
                      const checked = channel.locked ? true : (draft.get(cellKey(type.type, channel.channel)) ?? channel.enabled);
                      return (
                        <div key={channel.channel} className="flex min-w-0 flex-col gap-1 sm:w-56">
                          <Switch
                            id={id}
                            label={channel.label}
                            aria-label={`${type.label}, ${channel.label}`}
                            aria-describedby={channel.locked ? `${id}-locked` : undefined}
                            checked={checked}
                            disabled={channel.locked}
                            onCheckedChange={(enabled) => {
                              if (!channel.locked) toggle(type.type, channel.channel, enabled);
                            }}
                          />
                          {channel.locked ? (
                            <span id={`${id}-locked`} className="flex items-start gap-1 text-caption text-fg-subtle">
                              <Icon icon={Lock} size={14} className="mt-0.5 shrink-0" />
                              Obligatoire : ce canal reste actif pour cet événement.
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      {save.isError ? <FailureNotice title="Les préférences n’ont pas pu être enregistrées" error={save.error} /> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={changes.length === 0} loading={save.isPending}>
          Enregistrer
        </Button>
        <Button
          variant="ghost"
          disabled={changes.length === 0 || save.isPending}
          onClick={() => {
            setDraft(new Map());
            setSaved(false);
            save.reset();
          }}
        >
          Annuler
        </Button>
        <span role="status" className="text-caption text-fg-subtle">
          {saved ? 'Préférences enregistrées.' : ''}
        </span>
      </div>
    </form>
  );
}

export function NotificationPreferencesPanel({ audience }: NotificationPreferencesPanelProps) {
  const api = useRequiredNotificationsApi();
  const query = useNotificationPreferences(api);
  if (query.data === undefined) {
    return query.isError ? (
      <FailureNotice title="Les préférences n’ont pas pu être chargées" error={query.error} onRetry={() => void query.refetch()} />
    ) : (
      <Loading label="Chargement des préférences" rows={4} />
    );
  }
  const types = query.data.filter((type) => type.audience === audience);
  if (types.length === 0) {
    return <p className="text-body text-fg-muted">Aucune notification ne vous concerne pour l’instant.</p>;
  }
  return <PreferencesForm types={types} audience={audience} />;
}
