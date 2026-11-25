'use client';

import { Alert, Button, Card, EmptyState, Icon, Switch } from '@eguardimmo/ui';
import { Bell, Lock } from 'lucide-react';
import { useId, useState } from 'react';
import { plural } from '@/lib/format';
import { describeProblem } from '@/platform/errors';
import type { NotificationTypeSetting, TypeChange } from '@/platform/notificationSettings/notificationSettings';
import { useNotify } from '@/ui/notify';
import { PlatformState } from '@/ui/PlatformState';
import { groupBy } from './groupBy';
import { useNotificationTypes, useUpdateNotificationTypes } from './hooks';

type Draft = ReadonlyMap<string, boolean>;

const cellKey = (type: string, channel: string) => `${type}|${channel}`;

function changesOf(types: readonly NotificationTypeSetting[], draft: Draft): TypeChange[] {
  return types.flatMap((type) =>
    type.channels.flatMap(({ channel, enabled, locked }) => {
      const wanted = draft.get(cellKey(type.type, channel));
      return wanted === undefined || locked || wanted === enabled ? [] : [{ type: type.type, channel, enabled: wanted }];
    }),
  );
}

function TypeRow({ type, draft, onToggle }: { type: NotificationTypeSetting; draft: Draft; onToggle: (channel: string, enabled: boolean) => void }) {
  const baseId = useId();
  return (
    <li className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0">
      <span className="text-body-strong break-words">{type.label}</span>
      <div className="grid gap-3 sm:grid-cols-3">
        {type.channels.map((channel) => {
          const noteId = `${baseId}-${channel.channel}`;
          const note = channel.locked ? 'Obligatoire : ce canal ne peut pas être coupé.' : channel.default ? null : 'Inactif par défaut chez les destinataires.';
          return (
            <div key={channel.channel} className="flex min-w-0 flex-col items-start gap-1">
              <Switch
                label={channel.label}
                aria-label={`${type.label}, ${channel.label}`}
                aria-describedby={note ? noteId : undefined}
                checked={channel.locked || (draft.get(cellKey(type.type, channel.channel)) ?? channel.enabled)}
                disabled={channel.locked}
                onCheckedChange={(enabled) => { onToggle(channel.channel, enabled); }}
              />
              {note ? (
                <span id={noteId} className="flex items-start gap-1 text-caption text-fg-subtle">
                  {channel.locked ? <Icon icon={Lock} size={14} className="mt-0.5 shrink-0" /> : null}
                  {note}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </li>
  );
}

function TypesForm({ types }: { types: readonly NotificationTypeSetting[] }) {
  const notify = useNotify();
  const update = useUpdateNotificationTypes();
  const [draft, setDraft] = useState<Draft>(new Map());
  const [failure, setFailure] = useState<string | null>(null);
  const changes = changesOf(types, draft);

  const discard = () => {
    setDraft(new Map());
    setFailure(null);
  };

  const save = async () => {
    setFailure(null);
    try {
      await update.mutateAsync(changes);
      setDraft(new Map());
      notify.success('Réglages enregistrés');
    } catch (error) {
      const problem = describeProblem(error);
      setFailure(problem.code === 'notification_channel_mandatory' ? 'Un canal obligatoire ne peut pas être coupé.' : problem.message);
    }
  };

  return (
    <form
      noValidate
      aria-label="Canaux des notifications"
      className="flex min-w-0 flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <p className="text-body text-fg-muted">
        Couper un canal l’arrête pour tous les comptes. Un canal laissé actif suit toujours les préférences de chaque destinataire.
      </p>
      {groupBy(types, (type) => type.audience).map((audience) => (
        <section key={audience.key} aria-label={`Notifications : ${audience.items[0]?.audience_label ?? audience.key}`} className="flex flex-col gap-3">
          <h2 className="text-block-title">{audience.items[0]?.audience_label}</h2>
          {groupBy(audience.items, (type) => type.group).map((group) => (
            <Card key={group.key} className="px-4 py-3">
              <h3 className="text-body-strong text-fg-muted">{group.key}</h3>
              <ul className="flex flex-col">
                {group.items.map((type) => (
                  <TypeRow
                    key={type.type}
                    type={type}
                    draft={draft}
                    onToggle={(channel, enabled) => {
                      setFailure(null);
                      setDraft((current) => new Map(current).set(cellKey(type.type, channel), enabled));
                    }}
                  />
                ))}
              </ul>
            </Card>
          ))}
        </section>
      ))}
      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-line bg-surface py-3">
        {failure ? <Alert tone="danger" title="Les réglages n’ont pas été enregistrés">{failure}</Alert> : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span role="status" className="mr-auto text-caption text-fg-subtle">
            {changes.length === 0 ? 'Aucun changement' : plural(changes.length, 'changement à enregistrer', 'changements à enregistrer')}
          </span>
          <Button variant="ghost" disabled={changes.length === 0 || update.isPending} onClick={discard}>
            Annuler
          </Button>
          <Button type="submit" disabled={changes.length === 0} loading={update.isPending}>
            Enregistrer
          </Button>
        </div>
      </div>
    </form>
  );
}

export function NotificationTypesPanel() {
  const types = useNotificationTypes();
  return (
    <PlatformState query={types} label="Le catalogue des notifications">
      {(rows) =>
        rows.length === 0 ? (
          <EmptyState icon={Bell} title="Aucune notification" description="Le serveur ne propose aucun type de notification." />
        ) : (
          <TypesForm types={rows} />
        )
      }
    </PlatformState>
  );
}
