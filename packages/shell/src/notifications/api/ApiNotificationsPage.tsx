'use client';

import { Bell, BellOff, CheckCheck, Settings } from 'lucide-react';
import { useState } from 'react';
import { Button, EmptyState, Icon, Skeleton, Tab, TabList, TabPanel, Tabs, cx } from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';
import { FailureNotice } from '../../account/parts';
import { useRequiredNotificationsApi } from './context';
import { NotificationEntry } from './NotificationEntry';
import type { ApiNotification } from './model';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationFeed, useUnreadCount } from './queries';

export interface ApiNotificationsPageProps {
  Link: LinkComponent;
  settingsHref?: string;
}

type Filter = 'toutes' | 'non-lues';

function isFilter(value: string): value is Filter {
  return value === 'toutes' || value === 'non-lues';
}

function ListSkeleton() {
  return (
    <div role="status" aria-label="Chargement des notifications" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex items-center gap-3">
          <Skeleton shape="circle" className="size-9" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="w-1/2" />
            <Skeleton className="w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ApiNotificationsPage({ Link, settingsHref }: ApiNotificationsPageProps) {
  const api = useRequiredNotificationsApi();
  const [filter, setFilter] = useState<Filter>('toutes');
  const unreadOnly = filter === 'non-lues';
  const feed = useNotificationFeed(api, unreadOnly);
  const count = useUnreadCount(api);
  const markOne = useMarkNotificationRead(api);
  const markAll = useMarkAllNotificationsRead(api);
  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];

  const open = (item: ApiNotification) => {
    if (item.unread) markOne.mutate(item.id);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-page-title">Notifications</h1>
        <div className="flex flex-wrap items-center gap-2">
          {settingsHref ? (
            <Button asChild variant="secondary">
              <Link href={settingsHref}>
                <Icon icon={Settings} />
                Préférences
              </Link>
            </Button>
          ) : null}
          <Button
            variant="secondary"
            disabled={count.data === undefined || count.data === 0}
            loading={markAll.isPending}
            onClick={() => { markAll.mutate(); }}
          >
            <Icon icon={CheckCheck} />
            Tout marquer comme lu
          </Button>
        </div>
      </div>

      {markAll.isError || markOne.isError ? (
        <FailureNotice title="La mise à jour a échoué" error={markAll.error ?? markOne.error} />
      ) : null}

      <Tabs
        value={filter}
        defaultValue="toutes"
        onValueChange={(value) => {
          if (isFilter(value)) setFilter(value);
        }}
      >
        <TabList aria-label="Filtrer les notifications">
          <Tab value="toutes">Toutes</Tab>
          <Tab value="non-lues" count={count.data}>Non lues</Tab>
        </TabList>
        <TabPanel value={filter}>
          {feed.isError && feed.data === undefined ? (
            <FailureNotice title="Les notifications n’ont pas pu être chargées" error={feed.error} onRetry={() => void feed.refetch()} />
          ) : feed.isPending ? (
            <ListSkeleton />
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-line bg-surface">
              <EmptyState
                icon={unreadOnly ? BellOff : Bell}
                title={unreadOnly ? 'Aucune notification non lue' : 'Aucune notification'}
                description={unreadOnly ? 'Tout est à jour. Les nouvelles notifications apparaîtront ici.' : 'Les alertes de votre espace apparaîtront ici.'}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <ul aria-label="Notifications" className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
                {items.map((item) => (
                  <li key={item.id} className={cx('flex flex-col border-b border-muted last:border-b-0 sm:flex-row sm:items-center sm:gap-2 sm:pr-2', item.unread && 'bg-action-subtle/60')}>
                    <NotificationEntry item={item} Link={Link} onOpen={open} large className="min-w-0 flex-1 px-3 py-3" />
                    {item.unread ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mr-2 mb-2 self-end sm:m-0"
                        disabled={markOne.isPending}
                        onClick={() => { markOne.mutate(item.id); }}
                        aria-label={`Marquer comme lue : ${item.title}`}
                      >
                        Marquer comme lue
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {feed.isError ? (
                <FailureNotice title="La suite n’a pas pu être chargée" error={feed.error} onRetry={() => void feed.fetchNextPage()} />
              ) : null}
              {feed.hasNextPage ? (
                <div className="flex justify-center">
                  <Button variant="secondary" loading={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>
                    Charger plus
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </TabPanel>
      </Tabs>
    </>
  );
}
