'use client';

import { useCallback, useState } from 'react';
import { Pagination, Tab, TabList, TabPanel, Tabs } from '@eguardimmo/ui';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../../components/parts';
import { consoleErrorMessage } from '../api/errors';
import { BoardFilters } from '../components/BoardFilters';
import { PrivacyNote, ConsoleHeader } from '../components/parts';
import { StatsStrip } from '../components/StatsStrip';
import { TicketRow } from '../components/TicketRow';
import { consoleTabLabel } from '../copy';
import { EMPTY_QUERY, isUnreadForSupport } from '../model';
import type { ConsoleTicketQuery, ConsoleTicketSummary } from '../model';
import { useConsoleTickets } from '../queries';

type Tabbed = ConsoleTicketQuery['status'];
const TABS: readonly Tabbed[] = ['all', 'open', 'waiting', 'resolved'];

function isTab(value: string): value is Tabbed {
  return (TABS as readonly string[]).includes(value);
}

export function ConsoleSupportBoardPage() {
  const [query, setQuery] = useState<ConsoleTicketQuery>(EMPTY_QUERY);
  const [organizationLabel, setOrganizationLabel] = useState<string | null>(null);
  const tickets = useConsoleTickets(query);
  const change = useCallback((patch: Partial<ConsoleTicketQuery>) => {
    setQuery((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  }, []);
  const filterOrganization = (ticket: ConsoleTicketSummary) => {
    setOrganizationLabel(ticket.organizationName);
    change({ organization: ticket.organizationId });
  };
  const data = tickets.data;
  const unreadOnPage = data?.items.filter(isUnreadForSupport).length ?? 0;
  let content;
  if (data === undefined) {
    content = tickets.isError ? (
      <ErrorBlock message={consoleErrorMessage(tickets.error)} onRetry={() => { void tickets.refetch(); }} />
    ) : (
      <LoadingBlock label="Chargement des demandes" />
    );
  } else if (data.items.length === 0) {
    content = <EmptyBlock title="Aucune demande ne correspond" hint="Modifiez les filtres ou la recherche." />;
  } else {
    content = (
      <>
        <p role="status" aria-live="polite" className="text-caption text-fg-subtle">
          {unreadOnPage === 0 ? 'Aucune demande non lue sur cette page.' : `${String(unreadOnPage)} demande${unreadOnPage > 1 ? 's' : ''} non lue${unreadOnPage > 1 ? 's' : ''} sur cette page.`}
        </p>
        <ul aria-label="Demandes de support" className="overflow-hidden rounded-lg border border-line bg-surface">
          {data.items.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} onFilterOrganization={filterOrganization} />
          ))}
        </ul>
        <Pagination page={data.page} pageSize={data.perPage} total={data.total} label="Pagination des demandes" onPageChange={(page) => { change({ page }); }} />
      </>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ConsoleHeader title="Support" subtitle="Demandes d’assistance des organisations, propriétaires et locataires." />
      <StatsStrip />
      <BoardFilters query={query} organizationLabel={organizationLabel} onChange={change} />
      <Tabs value={query.status} defaultValue={query.status} onValueChange={(value) => { if (isTab(value)) change({ status: value }); }}>
        <TabList aria-label="Filtrer par statut">
          {TABS.map((id) => (
            <Tab key={id} value={id} {...(data ? { count: data.counts[id] } : {})}>
              {consoleTabLabel[id]}
            </Tab>
          ))}
        </TabList>
        <TabPanel value={query.status} className="flex min-w-0 flex-col gap-3">
          {content}
        </TabPanel>
      </Tabs>
      <PrivacyNote />
    </div>
  );
}
