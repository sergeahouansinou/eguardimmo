'use client';

import { Badge, cx } from '@eguardimmo/ui';
import { formatDayMonthTime } from '../../../lib/dates';
import { categoryLabel, spaceLabel } from '../../copy';
import { consoleStatusLabel, priorityLabel } from '../copy';
import { useConsoleSupportConfig } from '../context';
import { isUnreadForSupport } from '../model';
import type { ConsoleTicketSummary } from '../model';
import { priorityTone, statusTone } from './parts';

export function TicketRow({ ticket, onFilterOrganization }: { ticket: ConsoleTicketSummary; onFilterOrganization: (ticket: ConsoleTicketSummary) => void }) {
  const { Link, routes } = useConsoleSupportConfig();
  const unread = isUnreadForSupport(ticket);
  const origin = ticket.organizationName ?? spaceLabel[ticket.space];
  return (
    <li className="flex min-w-0 flex-col items-stretch border-b border-line last:border-b-0 sm:flex-row">
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
              {unread ? <span className="sr-only">Non lue, </span> : null}
              {ticket.subject}
            </span>
            <time dateTime={ticket.updatedAt} className="shrink-0 text-caption text-fg-subtle">
              {formatDayMonthTime(ticket.updatedAt)}
            </time>
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-caption text-fg-subtle">{ticket.reference}</span>
            <Badge tone={statusTone[ticket.status]}>{consoleStatusLabel[ticket.status]}</Badge>
            {ticket.priority === 'high' ? <Badge tone={priorityTone.high}>{`Priorité ${priorityLabel.high.toLowerCase()}`}</Badge> : null}
            {ticket.firstResponseOverdue ? <Badge tone="danger">Première réponse en retard</Badge> : null}
            <Badge>{categoryLabel[ticket.category]}</Badge>
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-fg-muted">
            <span className="break-words">{`${ticket.requester.name} · ${origin}`}</span>
            <span>{ticket.assignee ? `Assignée à ${ticket.assignee.name}` : 'Non assignée'}</span>
            <span>{`${String(ticket.messageCount)} message${ticket.messageCount > 1 ? 's' : ''}`}</span>
          </span>
        </span>
        {unread ? <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-action" /> : null}
      </Link>
      {ticket.organizationId !== null ? (
        <div className="flex items-start px-2 pb-2 sm:py-2.5">
          <button
            type="button"
            className="cursor-pointer rounded-sm px-1.5 py-1 text-caption text-fg-muted underline underline-offset-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            aria-label={`Filtrer sur l’organisation ${origin}`}
            onClick={() => { onFilterOrganization(ticket); }}
          >
            Même organisation
          </button>
        </div>
      ) : null}
    </li>
  );
}
