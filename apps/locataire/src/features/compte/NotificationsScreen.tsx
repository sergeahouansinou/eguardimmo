'use client';

import { useMarkAllNotificationsRead, useShellData } from '@eguardimmo/shell';
import { toneTile } from '@eguardimmo/shell';
import { Button, cx } from '@eguardimmo/ui';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { ACCOUNT_TABS, RouteTabs } from '@/components/RouteTabs';
import { Async2 } from '@/components/ScreenState';
import { EmptyLine, KeyValueList, SectionCard } from '@/components/Section';
import { Switch } from '@/components/Switch';
import { usePreferences, useProfile, useSetPreference } from '@/data/queries';
import type { Preference } from '@/data/schemas/compte';

export function NotificationsScreen() {
  const preferences = usePreferences();
  const profile = useProfile();
  return (
    <>
      <PageHeader
        title="Notifications"
        crumbs={[{ label: 'Mes informations', href: '/compte' }, { label: 'Notifications' }]}
        subtitle="Choisissez comment être prévenu, pour chaque type d'événement."
      />
      <RouteTabs label="Mon compte" tabs={ACCOUNT_TABS} />
      <Async2 a={preferences} b={profile} errorTitle="Vos préférences n’ont pas pu être chargées">
        {(items, profileData) => (
          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <PreferencesCard items={items} />
            <div className="flex min-w-0 flex-col gap-3">
              <SectionCard id="no-canaux" title="Canaux">
                <KeyValueList
                  labelWidth="4rem"
                  items={[
                    { label: 'E-mail', value: profileData.email },
                    { label: 'Push', value: `iPhone de ${profileData.firstName}` },
                  ]}
                />
              </SectionCard>
              <SectionCard id="no-toujours" title="Toujours envoyés">
                <p className="text-body text-fg-muted">Les messages légaux, comme un congé ou une quittance, sont toujours envoyés par e-mail.</p>
              </SectionCard>
              <RecentNotifications />
            </div>
          </div>
        )}
      </Async2>
    </>
  );
}

function PreferencesCard({ items }: { items: Preference[] }) {
  const save = useSetPreference();
  let status = 'Enregistré automatiquement';
  if (save.isPending) status = 'Enregistrement…';
  if (save.isSuccess) status = 'Enregistré';
  return (
    <SectionCard
      id="no-preferences"
      title="Préférences par événement"
      aside={
        <span role={save.isError ? 'alert' : 'status'} className={cx('text-caption', save.isError ? 'text-fg-danger' : 'text-fg-subtle')}>
          {save.isError ? 'L’enregistrement a échoué, réessayez.' : status}
        </span>
      }
    >
      <DataTable
        label="Préférences de notification"
        rows={items}
        rowKey={(item) => item.id}
        columns={[
          {
            id: 'evenement',
            header: 'Événement',
            primary: true,
            cell: (item) => (
              <>
                {item.label}
                <br />
                <span className="text-caption font-normal text-fg-subtle">{item.detail}</span>
              </>
            ),
          },
          {
            id: 'email',
            header: 'E-mail',
            numeric: true,
            cell: (item) => (
              <Switch
                label={`${item.label}, e-mail`}
                checked={item.email}
                onCheckedChange={(enabled) => { save.mutate({ id: item.id, channel: 'email', enabled }); }}
              />
            ),
          },
          {
            id: 'push',
            header: 'Notification push',
            mobileLabel: 'Push',
            numeric: true,
            cell: (item) => (
              <Switch
                label={`${item.label}, notification push`}
                checked={item.push}
                onCheckedChange={(enabled) => { save.mutate({ id: item.id, channel: 'push', enabled }); }}
              />
            ),
          },
        ]}
      />
    </SectionCard>
  );
}

function RecentNotifications() {
  const shell = useShellData();
  const markAll = useMarkAllNotificationsRead();
  const items = shell.data?.notifications ?? [];
  const unread = items.some((item) => item.unread);
  return (
    <SectionCard
      id="no-recentes"
      title="Dernières notifications"
      aside={
        <Button variant="link" size="sm" disabled={!unread} loading={markAll.isPending} onClick={() => { markAll.mutate(); }}>
          Tout marquer comme lu
        </Button>
      }
    >
      {items.length === 0 ? (
        <EmptyLine>Aucune notification.</EmptyLine>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2.5 border-t border-line py-2 first:border-t-0">
              <span aria-hidden="true" className={cx('mt-1.5 size-2 shrink-0 rounded-full', item.unread ? toneTile[item.tone] : 'bg-line')} />
              <span className="flex min-w-0 flex-1 flex-col">
                <Link href={item.href} className="truncate text-body-strong text-fg hover:underline">
                  {item.title}
                  {item.unread ? <span className="sr-only"> (non lue)</span> : null}
                </Link>
                <span className="truncate text-caption text-fg-subtle">{item.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
