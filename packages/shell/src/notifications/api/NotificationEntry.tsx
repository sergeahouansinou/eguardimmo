'use client';

import { Icon, cx } from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';
import { formatDateTime } from '../../account/format';
import { toneTile } from '../../lib/tone';
import { toneIcon } from '../../lib/toneIcon';
import { internalHref } from './href';
import type { ApiNotification } from './model';

export interface NotificationEntryProps {
  item: ApiNotification;
  Link: LinkComponent;
  onOpen: (item: ApiNotification) => void;
  large?: boolean;
  className?: string;
}

function EntryBody({ item, large }: { item: ApiNotification; large: boolean }) {
  return (
    <>
      <span className={cx('inline-flex shrink-0 items-center justify-center rounded-md', large ? 'size-9' : 'size-8', toneTile[item.tone])}>
        <Icon icon={toneIcon[item.tone]} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <b className={cx('text-body font-semibold', large ? '[overflow-wrap:anywhere]' : 'truncate')}>{item.title}</b>
        <span className={cx('text-caption font-normal text-fg-subtle', large ? '[overflow-wrap:anywhere]' : 'truncate')}>{item.detail}</span>
        {large ? <span className="text-caption font-normal text-fg-subtle">{formatDateTime(item.createdAt)}</span> : null}
      </span>
      {item.unread ? (
        <>
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-action" />
          <span className="sr-only">Non lue</span>
        </>
      ) : null}
    </>
  );
}

export function NotificationEntry({ item, Link, onOpen, large = false, className }: NotificationEntryProps) {
  const href = internalHref(item.href);
  const classes = cx(
    'flex items-center gap-2.5 text-fg hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
    className,
  );
  if (href === null) {
    return (
      <button type="button" onClick={() => { onOpen(item); }} className={cx(classes, 'w-full')}>
        <EntryBody item={item} large={large} />
      </button>
    );
  }
  return (
    <Link href={href} onClick={() => { onOpen(item); }} className={classes}>
      <EntryBody item={item} large={large} />
    </Link>
  );
}
