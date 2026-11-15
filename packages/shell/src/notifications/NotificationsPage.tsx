'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, CheckCheck, Settings } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, EmptyState, Icon, Pagination, Skeleton, Tab, TabList, TabPanel, Tabs, cx } from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';
import {
  shellKeys,
  useCanMarkNotificationRead,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useShellData,
} from '../data/queries';
import type { ShellNotification } from '../data/schemas';
import { toneTile } from '../lib/tone';
import { toneIcon } from '../lib/toneIcon';

const DEFAULT_PAGE_SIZE = 20;

type Filter = 'toutes' | 'non-lues';

export interface NotificationsPageProps {
  Link: LinkComponent;
  settingsHref?: string;
  pageSize?: number;
}

function isFilter(value: string): value is Filter {
  return value === 'toutes' || value === 'non-lues';
}

function NotificationRow({
  item,
  Link,
  onMarkRead,
  pending,
}: {
  item: ShellNotification;
  Link: LinkComponent;
  onMarkRead: (() => void) | null;
  pending: boolean;
}) {
  return (
    <li className={cx('flex items-center gap-2 border-b border-muted pr-2 last:border-b-0', item.unread && 'bg-action-subtle/60')}>
      <Link
        href={item.href}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-fg hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <span className={cx('inline-flex size-9 shrink-0 items-center justify-center rounded-md', toneTile[item.tone])}>
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
      {item.unread && onMarkRead ? (
        <Button variant="ghost" size="sm" disabled={pending} onClick={onMarkRead} aria-label={`Marquer comme lue : ${item.title}`}>
          Marquer comme lue
        </Button>
      ) : null}
    </li>
  );
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

export function NotificationsPage({ Link, settingsHref, pageSize = DEFAULT_PAGE_SIZE }: NotificationsPageProps) {
  const shell = useShellData();
  const client = useQueryClient();
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();
  const canMarkOne = useCanMarkNotificationRead();
  const [filter, setFilter] = useState<Filter>('toutes');
  const [page, setPage] = useState(1);

  const notifications = shell.data?.notifications ?? [];
  const unread = notifications.filter((item) => item.unread).length;
  const visible = filter === 'non-lues' ? notifications.filter((item) => item.unread) : notifications;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const current = Math.min(page, pageCount);
  const rows = visible.slice((current - 1) * pageSize, current * pageSize);
  const mutationFailed = markAll.isError || markOne.isError;

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
            disabled={shell.data === undefined || unread === 0}
            loading={markAll.isPending}
            onClick={() => { markAll.mutate(); }}
          >
            <Icon icon={CheckCheck} />
            Tout marquer comme lu
          </Button>
        </div>
      </div>

      {shell.isError ? (
        <Alert tone="danger" title="Les notifications n’ont pas pu être chargées">
          <div className="flex flex-col items-start gap-2">
            <span>Vérifiez votre connexion puis réessayez.</span>
            <Button size="sm" variant="secondary" onClick={() => void client.invalidateQueries({ queryKey: shellKeys.data })}>
              Réessayer
            </Button>
          </div>
        </Alert>
      ) : null}

      {mutationFailed ? (
        <Alert tone="danger" title="La mise à jour a échoué">
          Les notifications n’ont pas pu être marquées comme lues. Réessayez.
        </Alert>
      ) : null}

      {shell.isError ? null : (
        <Tabs
          value={filter}
          defaultValue="toutes"
          onValueChange={(value) => {
            if (isFilter(value)) {
              setFilter(value);
              setPage(1);
            }
          }}
        >
          <TabList aria-label="Filtrer les notifications">
            <Tab value="toutes" count={shell.data ? notifications.length : undefined}>
              Toutes
            </Tab>
            <Tab value="non-lues" count={shell.data ? unread : undefined}>
              Non lues
            </Tab>
          </TabList>
          <TabPanel value={filter}>
            {shell.isPending ? (
              <ListSkeleton />
            ) : visible.length === 0 ? (
              <div className="rounded-lg border border-line bg-surface">
                <EmptyState
                  icon={filter === 'non-lues' ? BellOff : Bell}
                  title={filter === 'non-lues' ? 'Aucune notification non lue' : 'Aucune notification'}
                  description={
                    filter === 'non-lues'
                      ? 'Tout est à jour. Les nouvelles notifications apparaîtront ici.'
                      : 'Les alertes de votre espace apparaîtront ici.'
                  }
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <ul aria-label="Notifications" className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
                  {rows.map((item) => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      Link={Link}
                      pending={markOne.isPending}
                      onMarkRead={canMarkOne ? () => { markOne.mutate(item.id); } : null}
                    />
                  ))}
                </ul>
                {visible.length > pageSize ? (
                  <Pagination
                    label="Pagination des notifications"
                    page={current}
                    pageSize={pageSize}
                    total={visible.length}
                    onPageChange={setPage}
                  />
                ) : null}
              </div>
            )}
          </TabPanel>
        </Tabs>
      )}
    </>
  );
}
