'use client';

import { Bell, Settings } from 'lucide-react';
import { useState } from 'react';
import { IconButton, Popover, PopoverContent, PopoverTrigger, Tab, TabList, TabPanel, Tabs, cx } from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';
import { FailureNotice } from '../../account/parts';
import type { NotificationsConfig } from '../../config/types';
import { NotificationEntry } from './NotificationEntry';
import type { ApiNotification, NotificationsApi } from './model';
import { useBellNotifications, useMarkAllNotificationsRead, useMarkNotificationRead, useUnreadCount } from './queries';

export interface ApiNotificationsPanelProps {
  api: NotificationsApi;
  config: NotificationsConfig;
  Link: LinkComponent;
  onNavigate: (href: string) => void;
}

const MAX_BADGE = 99;

function UnreadBadge({ count }: { count: number }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-action px-1 text-[11px] leading-none font-semibold text-on-action tabular-nums"
    >
      {count > MAX_BADGE ? `${String(MAX_BADGE)}+` : count}
    </span>
  );
}

export function ApiNotificationsPanel({ api, config, Link, onNavigate }: ApiNotificationsPanelProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('toutes');
  const unreadOnly = filter === 'non-lues';
  const count = useUnreadCount(api);
  const list = useBellNotifications(api, unreadOnly, open);
  const markRead = useMarkNotificationRead(api);
  const markAll = useMarkAllNotificationsRead(api);
  const unread = count.data ?? 0;
  const label = unread > 0 ? `Notifications, ${String(unread)} non lues` : 'Notifications';
  const close = () => { setOpen(false); };
  const items = list.data?.items ?? [];

  const openItem = (item: ApiNotification) => {
    if (item.unread) markRead.mutate(item.id);
    close();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <span className="relative inline-flex">
        <PopoverTrigger asChild>
          <IconButton label={label} icon={Bell} variant="secondary" />
        </PopoverTrigger>
        {unread > 0 ? <UnreadBadge count={unread} /> : null}
      </span>
      <PopoverContent aria-label="Notifications" className="w-[360px]">
        <div className="flex h-12 items-center justify-between border-b border-line px-3 text-body-strong font-semibold">
          <span>Notifications</span>
          <button
            type="button"
            disabled={unread === 0 || markAll.isPending}
            onClick={() => { markAll.mutate(); }}
            className="text-caption text-action hover:underline disabled:cursor-not-allowed disabled:text-fg-disabled disabled:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Tout marquer comme lu
          </button>
        </div>
        <Tabs value={filter} onValueChange={setFilter} defaultValue="toutes">
          <TabList aria-label="Filtrer les notifications" className="gap-4 px-3">
            <Tab value="toutes">Toutes</Tab>
            <Tab value="non-lues" count={count.data}>Non lues</Tab>
          </TabList>
          {markAll.isError ? (
            <div className="px-3 py-2">
              <FailureNotice title="Les notifications n’ont pas pu être marquées comme lues" error={markAll.error} />
            </div>
          ) : null}
          {list.isError ? (
            <div className="px-3 py-2">
              <FailureNotice title="Les notifications n’ont pas pu être chargées" error={list.error} onRetry={() => void list.refetch()} />
            </div>
          ) : null}
          <TabPanel value={filter}>
            <ul aria-label="Dernières notifications" className="flex max-h-[360px] flex-col overflow-y-auto">
              {list.isPending ? (
                <li role="status" className="px-3 py-6 text-center text-body text-fg-subtle">Chargement des notifications…</li>
              ) : null}
              {list.data !== undefined && items.length === 0 ? (
                <li className="px-3 py-6 text-center text-body text-fg-subtle">
                  {unreadOnly ? 'Aucune notification non lue.' : 'Aucune notification.'}
                </li>
              ) : null}
              {items.map((item) => (
                <li key={item.id} className={cx('border-b border-muted', item.unread && 'bg-action-subtle/60')}>
                  <NotificationEntry item={item} Link={Link} onOpen={openItem} className="px-3 py-2.5" />
                </li>
              ))}
            </ul>
          </TabPanel>
        </Tabs>
        <div className="flex h-11 items-center justify-between pr-2 pl-3">
          <Link
            href={config.allHref}
            onClick={close}
            className="text-caption text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Voir toutes les notifications
          </Link>
          {config.settingsHref ? (
            <IconButton
              label="Réglages des notifications"
              icon={Settings}
              onClick={() => {
                close();
                if (config.settingsHref) onNavigate(config.settingsHref);
              }}
            />
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
