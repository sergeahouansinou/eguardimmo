'use client';

import { formatDate } from '../../lib/dates';
import { attachmentCountLabel } from '../../lib/text';
import { useAnnouncementsConfig } from '../context';
import type { Announcement } from '../model';

export function AnnouncementRow({ announcement }: { announcement: Announcement }) {
  const { Link, routes } = useAnnouncementsConfig();
  return (
    <li className="relative min-w-0 overflow-hidden border-b border-line last:border-b-0">
      <Link
        href={routes.detail(announcement.id)}
        className="flex min-w-0 items-start gap-3 px-3 py-3 hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <span
          aria-hidden="true"
          className={announcement.unread ? 'mt-1.5 size-2.5 shrink-0 rounded-full bg-accent' : 'mt-1.5 size-2.5 shrink-0 rounded-full border border-line-control'}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={announcement.unread ? 'truncate text-body font-semibold text-fg' : 'truncate text-body text-fg'}>
            {announcement.subject}
            {announcement.unread ? <span className="sr-only"> (non lue)</span> : null}
          </span>
          <span className="truncate text-caption text-fg-muted">
            {announcement.organizationName}
            {announcement.sentAt ? ` · ${formatDate(announcement.sentAt)}` : ''}
            {announcement.attachments.length > 0 ? ` · ${attachmentCountLabel(announcement.attachments.length)}` : ''}
          </span>
        </span>
      </Link>
    </li>
  );
}
