'use client';

import { useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from '@eguardimmo/ui';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/parts';
import { supportErrorMessage } from '../api/errors';
import { useSupportConfig } from '../context';
import type { SupportTicketSummary } from '../model';
import { useSupportTickets } from '../queries';
import { isTicketUnread } from '../unread';
import { TicketRow } from './TicketRow';

type BoardTab = 'all' | 'unread' | 'resolved';

function filtered(tickets: readonly SupportTicketSummary[], tab: BoardTab, unreadOf: (ticket: SupportTicketSummary) => boolean) {
  if (tab === 'unread') return tickets.filter(unreadOf);
  if (tab === 'resolved') return tickets.filter((ticket) => ticket.status === 'resolved');
  return tickets;
}

const EMPTY: Record<BoardTab, { title: string; hint?: string }> = {
  all: { title: 'Aucune demande pour le moment', hint: 'Vos demandes au support apparaîtront ici avec leur statut.' },
  unread: { title: 'Aucune réponse à lire' },
  resolved: { title: 'Aucune demande résolue' },
};

export function TicketBoard() {
  const { seen } = useSupportConfig();
  const tickets = useSupportTickets();
  const [tab, setTab] = useState<BoardTab>('all');

  if (tickets.data === undefined) {
    return tickets.isError ? (
      <ErrorBlock message={supportErrorMessage(tickets.error)} onRetry={() => { void tickets.refetch(); }} />
    ) : (
      <LoadingBlock label="Chargement de vos demandes" />
    );
  }

  const unreadOf = (ticket: SupportTicketSummary) => isTicketUnread(ticket, seen);
  const unread = tickets.data.filter(unreadOf).length;
  const items = filtered(tickets.data, tab, unreadOf);
  return (
    <Tabs value={tab} defaultValue={tab} onValueChange={(value) => { setTab(value === 'unread' || value === 'resolved' ? value : 'all'); }}>
      <TabList aria-label="Filtrer les demandes">
        <Tab value="all">Toutes</Tab>
        <Tab value="unread" count={unread}>Réponses à lire</Tab>
        <Tab value="resolved">Résolues</Tab>
      </TabList>
      <TabPanel value={tab} className="flex min-w-0 flex-col gap-3">
        {items.length === 0 ? (
          <EmptyBlock title={EMPTY[tab].title} {...(EMPTY[tab].hint ? { hint: EMPTY[tab].hint } : {})} />
        ) : (
          <ul aria-label="Mes demandes" className="overflow-hidden rounded-lg border border-line bg-surface">
            {items.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} unread={unreadOf(ticket)} />
            ))}
          </ul>
        )}
      </TabPanel>
    </Tabs>
  );
}
