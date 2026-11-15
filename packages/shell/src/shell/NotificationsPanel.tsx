'use client';

import { Bell, CircleAlert, CircleCheck, Info, Settings, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import {
  Icon,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tab,
  TabList,
  Tabs,
  cx,
} from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';
import { useMarkAllNotificationsRead } from '../data/queries';
import type { ShellNotification, Tone } from '../data/schemas';
import { toneTile } from '../lib/tone';
import type { NotificationsConfig } from '../config/types';

const toneIcon: Record<Tone, LucideIcon> = {
  danger: CircleAlert,
  warning: TriangleAlert,
  info: Info,
  success: CircleCheck,
  neutral: Bell,
};

export interface NotificationsPanelProps {
  notifications: ShellNotification[];
  config: NotificationsConfig;
  Link: LinkComponent;
  onNavigate: (href: string) => void;
}

export function NotificationsPanel({ notifications, config, Link, onNavigate }: NotificationsPanelProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('toutes');
  const markAll = useMarkAllNotificationsRead();
  const unread = notifications.filter((item) => item.unread).length;
  const visible = filter === 'non-lues' ? notifications.filter((item) => item.unread) : notifications;
  const label = unread > 0 ? `Notifications, ${String(unread)} non lues` : 'Notifications';
  const close = () => { setOpen(false); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <span className="relative inline-flex">
        <PopoverTrigger asChild>
          <IconButton label={label} icon={Bell} variant="secondary" />
        </PopoverTrigger>
        {unread > 0 ? (
          <span aria-hidden="true" className="pointer-events-none absolute top-1 right-1 size-1.5 rounded-full bg-action" />
        ) : null}
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
            <Tab value="non-lues" count={unread}>Non lues</Tab>
          </TabList>
        </Tabs>
        {markAll.isError ? (
          <p role="alert" className="px-3 py-2 text-caption text-fg-danger">
            Les notifications n’ont pas pu être marquées comme lues. Réessayez.
          </p>
        ) : null}
        <ul className="flex max-h-[360px] flex-col overflow-y-auto">
          {visible.length === 0 ? (
            <li className="px-3 py-6 text-center text-body text-fg-subtle">Aucune notification non lue.</li>
          ) : (
            visible.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={close}
                  className={cx(
                    'flex items-center gap-2.5 border-b border-muted px-3 py-2.5 text-fg hover:bg-muted',
                    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                    item.unread && 'bg-action-subtle/60',
                  )}
                >
                  <span className={cx('inline-flex size-8 shrink-0 items-center justify-center rounded-md', toneTile[item.tone])}>
                    <Icon icon={toneIcon[item.tone]} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="truncate text-body font-semibold">{item.title}</b>
                    <span className="truncate text-caption font-normal text-fg-subtle">{item.detail}</span>
                  </span>
                  {item.unread ? (
                    <>
                      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-action" />
                      <span className="sr-only">Non lue</span>
                    </>
                  ) : null}
                </Link>
              </li>
            ))
          )}
        </ul>
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
