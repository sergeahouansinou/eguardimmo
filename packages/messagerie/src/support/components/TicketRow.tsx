'use client';

import { Badge, cx } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { formatDayMonthTime } from '../../lib/dates';
import { categoryLabel, spaceLabel, statusLabel } from '../copy';
import { useSupportConfig } from '../context';
import type { SupportTicketStatus, SupportTicketSummary } from '../model';

export const statusTone: Record<SupportTicketStatus, BadgeTone> = { open: 'info', waiting: 'warning', resolved: 'success' };

export function TicketRow({ ticket, unread }: { ticket: SupportTicketSummary; unread: boolean }) {
  const { Link, routes } = useSupportConfig();
  return (
    <li className="flex min-w-0 items-stretch border-b border-line last:border-b-0">
      <Link
        href={routes.ticket(ticket.id)}
        className={cx(
          'flex min-w-0 flex-1 items-start gap-3 px-3 py-3 hover:bg-muted',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-baseline justify-between gap-2">
            <span className={cx('min-w-0 truncate text-body', unread ? 'font-semibold text-fg' : 'text-fg')}>
              {unread ? <span className="sr-only">Réponse non lue, </span> : null}
              {ticket.subject}
            </span>
            <time dateTime={ticket.updatedAt} className="shrink-0 text-caption text-fg-subtle">
              {formatDayMonthTime(ticket.updatedAt)}
            </time>
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-caption text-fg-subtle">{ticket.reference}</span>
            <Badge tone={statusTone[ticket.status]}>{statusLabel[ticket.status]}</Badge>
            <Badge>{categoryLabel[ticket.category]}</Badge>
            <span className="text-caption text-fg-subtle">{ticket.organizationName ?? spaceLabel[ticket.space]}</span>
          </span>
        </span>
        {unread ? <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-action" /> : null}
      </Link>
    </li>
  );
}
