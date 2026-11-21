'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Icon, TabPanel } from '@eguardimmo/ui';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/parts';
import { WidgetHelp } from '../../components/SupportWidget';
import { WidgetFrame } from '../../components/WidgetFrame';
import { useMessagerieConfig } from '../../config';
import { formatDayMonthTime } from '../../lib/dates';
import { supportErrorMessage } from '../api/errors';
import { useSupportConfig } from '../context';
import { statusLabel } from '../copy';
import { useSupportAvailability, useSupportTickets, useSupportUnread } from '../queries';
import { isTicketUnread } from '../unread';
import { PrivacyNote } from './parts';
import { statusTone } from './TicketRow';

const SHOWN = 3;

function SupportTab() {
  const { routes, Link, seen } = useSupportConfig();
  const tickets = useSupportTickets();
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href={routes.newRequest}>
            <Icon icon={Plus} />
            Nouvelle demande
          </Link>
        </Button>
        <Button asChild size="sm" variant="secondary">
          <Link href={routes.board}>Toutes mes demandes</Link>
        </Button>
      </div>
      {tickets.data === undefined ? (
        tickets.isError ? (
          <ErrorBlock message={supportErrorMessage(tickets.error)} onRetry={() => { void tickets.refetch(); }} />
        ) : (
          <LoadingBlock label="Chargement de vos demandes" />
        )
      ) : tickets.data.length === 0 ? (
        <EmptyBlock title="Aucune demande pour le moment" hint="Vos demandes au support apparaîtront ici avec leur statut." />
      ) : (
        <ul aria-label="Demandes récentes" className="overflow-hidden rounded-lg border border-line bg-surface">
          {tickets.data.slice(0, SHOWN).map((ticket) => (
            <li key={ticket.id} className="border-b border-line last:border-b-0">
              <Link
                href={routes.ticket(ticket.id)}
                className="flex min-w-0 flex-col gap-1 px-3 py-2.5 hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
              >
                <span className="flex min-w-0 items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-body font-medium text-fg">
                    {isTicketUnread(ticket, seen) ? <span className="sr-only">Réponse non lue, </span> : null}
                    {ticket.subject}
                  </span>
                  <time dateTime={ticket.updatedAt} className="shrink-0 text-caption text-fg-subtle">
                    {formatDayMonthTime(ticket.updatedAt)}
                  </time>
                </span>
                <span className="flex items-center gap-2 text-caption text-fg-muted">
                  {ticket.reference}
                  <Badge tone={statusTone[ticket.status]}>{statusLabel[ticket.status]}</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <PrivacyNote />
    </div>
  );
}

export function SupportApiWidget() {
  const { profile } = useMessagerieConfig();
  const availability = useSupportAvailability();
  const unread = useSupportUnread();
  const [tab, setTab] = useState('aide');

  if (!profile.help.supportTicket) return null;

  let subtitle = 'Chargement';
  if (availability.data) subtitle = `${availability.data.hoursLabel} · ${availability.data.responseLabel}`;
  else if (availability.isError) subtitle = 'Disponibilité inconnue';

  return (
    <WidgetFrame
      subtitle={subtitle}
      online={availability.data ? availability.data.online : null}
      tabs={[
        { value: 'aide', label: 'Aide' },
        { value: 'support', label: 'Support', ...(unread ? { count: unread } : {}) },
      ]}
      tab={tab}
      onTabChange={setTab}
      unread={unread ?? 0}
    >
      <TabPanel value="aide">
        <WidgetHelp onContact={() => { setTab('support'); }} />
      </TabPanel>
      <TabPanel value="support">
        <SupportTab />
      </TabPanel>
    </WidgetFrame>
  );
}
