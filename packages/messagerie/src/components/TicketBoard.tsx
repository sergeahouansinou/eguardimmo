'use client';

import { Clock, Inbox, LifeBuoy, ThumbsUp } from 'lucide-react';
import {
  Avatar,
  Badge,
  Pagination,
  Select,
  StatCard,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextField,
  cx,
} from '@eguardimmo/ui';
import { useMessagerieConfig } from '../config';
import type { TicketQuery } from '../data/inputs';
import { useStaff, useTicketStats, useTickets } from '../data/queries';
import { ticketPrioritySchema } from '../data/schemas';
import type { TicketSummary, TicketTab } from '../data/schemas';
import { formatDayMonthTime } from '../lib/dates';
import { EmptyBlock, ErrorBlock, LoadingBlock } from './parts';
import { categoryLabels, priorityLabels, priorityTones, statusLabels, statusTones } from './ticketMeta';

export type TicketFilters = Omit<TicketQuery, 'pageSize'>;

const tabs: { id: TicketTab; label: string }[] = [
  { id: 'ouvert', label: 'Ouverts' },
  { id: 'en_attente', label: 'En attente' },
  { id: 'resolu', label: 'Résolus' },
  { id: 'tous', label: 'Tous' },
];

const priorityOptions = [
  { value: 'toutes', label: 'Toutes priorités' },
  { value: 'haute', label: 'Haute' },
  { value: 'normale', label: 'Normale' },
  { value: 'basse', label: 'Basse' },
];

export const defaultTicketFilters: TicketFilters = {
  tab: 'ouvert',
  search: '',
  priority: 'toutes',
  assigneeId: 'tous',
  page: 1,
};

export interface TicketBoardProps {
  filters: TicketFilters;
  onFiltersChange: (filters: TicketFilters) => void;
}

function TicketStatsRow() {
  const stats = useTicketStats();
  if (stats.data === undefined) {
    return stats.isError ? (
      <ErrorBlock message="Impossible de charger les indicateurs." onRetry={stats.refetch} />
    ) : (
      <LoadingBlock label="Chargement des indicateurs" />
    );
  }
  const data = stats.data;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Tickets ouverts" value={data.open} icon={Inbox}>
        <span className="text-caption text-fg-subtle">{data.openHigh} priorité haute</span>
      </StatCard>
      <StatCard label="En attente client" value={data.waiting} icon={Clock}>
        <span className="text-caption text-fg-subtle">{data.waitingDetail}</span>
      </StatCard>
      <StatCard label="Première réponse" value={data.firstResponse} icon={LifeBuoy}>
        <span className="text-caption text-fg-subtle">{data.firstResponseDetail}</span>
      </StatCard>
      <StatCard label="Résolus (30 j)" value={data.resolved30d} icon={ThumbsUp}>
        <span className="text-caption text-fg-subtle">{data.satisfaction}</span>
      </StatCard>
    </div>
  );
}

function TicketRow({ ticket }: { ticket: TicketSummary }) {
  const { Link, routes } = useMessagerieConfig();
  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        href={routes.ticket(ticket.id)}
        className={cx(
          'flex min-w-0 items-start gap-3 px-3 py-3 hover:bg-muted',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
        )}
      >
        <Avatar initials={ticket.requester.initials} size="md" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-body font-semibold text-fg">{ticket.subject}</span>
            <time dateTime={ticket.updatedAt} className="shrink-0 text-caption text-fg-subtle">
              {formatDayMonthTime(ticket.updatedAt)}
            </time>
          </span>
          <span className="truncate text-caption text-fg-muted">
            {ticket.reference} · {ticket.organization} · {ticket.requester.name}
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={statusTones[ticket.status]}>{statusLabels[ticket.status]}</Badge>
            <Badge tone={priorityTones[ticket.priority]}>Priorité {priorityLabels[ticket.priority].toLowerCase()}</Badge>
            <Badge>{categoryLabels[ticket.category]}</Badge>
            <span className="text-caption text-fg-subtle">
              {ticket.assigneeName ? `Assigné à ${ticket.assigneeName}` : 'Non assigné'}
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}

export function TicketBoard({ filters, onFiltersChange }: TicketBoardProps) {
  const { profile } = useMessagerieConfig();
  const staff = useStaff();
  const query = useTickets({ ...filters, pageSize: profile.inbox.pageSize });
  const data = query.data;
  const change = (patch: Partial<TicketFilters>) => { onFiltersChange({ ...filters, page: 1, ...patch }); };

  const assigneeOptions = [
    { value: 'tous', label: 'Tous les opérateurs' },
    { value: 'none', label: 'Non assignés' },
    ...(staff.data ?? []).map((member) => ({ value: member.id, label: member.name })),
  ];

  let content;
  if (data === undefined) {
    content = query.isError ? (
      <ErrorBlock message="Impossible de charger les tickets." onRetry={query.refetch} />
    ) : (
      <LoadingBlock label="Chargement des tickets" />
    );
  } else if (data.items.length === 0) {
    content = (
      <EmptyBlock
        title="Aucun ticket ne correspond"
        hint="Modifiez la recherche ou les filtres pour élargir la liste."
      />
    );
  } else {
    content = (
      <>
        <ul aria-label="Tickets" className="overflow-hidden rounded-lg border border-line bg-surface">
          {data.items.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} />
          ))}
        </ul>
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          onPageChange={(page) => { onFiltersChange({ ...filters, page }); }}
          label="Pagination des tickets"
        />
      </>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <TicketStatsRow />
      <Tabs
        value={filters.tab}
        defaultValue={filters.tab}
        onValueChange={(value) => {
          const next = tabs.find((candidate) => candidate.id === value);
          if (next) change({ tab: next.id });
        }}
      >
        <TabList aria-label="Filtrer les tickets par statut">
          {tabs.map((item) => (
            <Tab key={item.id} value={item.id} {...(data ? { count: data.counts[item.id] } : {})}>
              {item.label}
            </Tab>
          ))}
        </TabList>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <TextField
            label={profile.inbox.searchLabel}
            hideLabel
            type="search"
            placeholder={profile.inbox.searchPlaceholder}
            value={filters.search}
            onChange={(event) => { change({ search: event.target.value }); }}
          />
          <Select
            label="Priorité"
            hideLabel
            placeholder="Priorité"
            options={priorityOptions}
            value={filters.priority}
            onValueChange={(value) => {
              const parsed = ticketPrioritySchema.safeParse(value);
              change({ priority: parsed.success ? parsed.data : 'toutes' });
            }}
          />
          <Select
            label="Assignation"
            hideLabel
            placeholder="Assignation"
            options={assigneeOptions}
            value={filters.assigneeId}
            onValueChange={(value) => { change({ assigneeId: value }); }}
          />
        </div>
        <TabPanel value={filters.tab} className="flex min-w-0 flex-col gap-3">
          {content}
        </TabPanel>
      </Tabs>
    </div>
  );
}
