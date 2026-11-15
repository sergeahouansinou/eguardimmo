'use client';

import { Alert, Switch } from '@eguardimmo/ui';
import { useState } from 'react';
import { errorMessage } from '@/console/hooks/core';
import { useSaveNotificationPrefs } from '@/console/hooks/mutations';
import { useNotificationPrefs } from '@/console/hooks/queries';
import { NOTIFICATION_GROUPS } from '@/console/schemas';
import type { NotificationPrefs } from '@/console/schemas';
import { QueryState } from '@/ui/QueryState';
import { ListRow, Section } from '@/ui/Section';
import { useNotify } from '@/ui/notify';
import { SaveBar } from './SaveBar';

export function NotificationsScreen() {
  const query = useNotificationPrefs();
  return (
    <QueryState query={query} label="Les préférences de notification">
      {(prefs) => <NotificationsForm saved={prefs} />}
    </QueryState>
  );
}

function sameValues(left: NotificationPrefs, right: NotificationPrefs): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => left[key] === right[key]);
}

function NotificationsForm({ saved }: { saved: NotificationPrefs }) {
  const notify = useNotify();
  const save = useSaveNotificationPrefs();
  const [draft, setDraft] = useState<NotificationPrefs>(saved);
  const [failure, setFailure] = useState<string | null>(null);
  const dirty = !sameValues(draft, saved);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setFailure(null);
        save.mutate(draft, {
          onSuccess: () => { notify.success('Notifications enregistrées', 'Vos préférences sont à jour.'); },
          onError: (error) => { setFailure(errorMessage(error)); },
        });
      }}
      className="flex flex-col gap-4"
    >
      {NOTIFICATION_GROUPS.map((group) => {
        const active = group.items.filter((item) => draft[item.key] === true).length;
        return (
          <Section
            key={group.id}
            id={`notif-${group.id}`}
            title={group.label}
            aside={<span className="text-caption text-fg-subtle">{`${String(active)} sur ${String(group.items.length)} actives`}</span>}
          >
            <ul>
              {group.items.map((item) => (
                <ListRow
                  key={item.key}
                  title={item.label}
                  detail={item.detail}
                  trailing={
                    <Switch
                      label={item.label}
                      hideLabel
                      checked={draft[item.key] === true}
                      onCheckedChange={(next) => { setDraft((current) => ({ ...current, [item.key]: next })); }}
                    />
                  }
                />
              ))}
            </ul>
          </Section>
        );
      })}
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      <SaveBar pending={save.isPending} dirty={dirty} onCancel={() => { setDraft(saved); setFailure(null); }} />
    </form>
  );
}
