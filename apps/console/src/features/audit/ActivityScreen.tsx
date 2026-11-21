'use client';

import { Alert, EmptyState, IconButton } from '@eguardimmo/ui';
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useActivityList } from '@/console/hooks/activity';
import { EMPTY_ACTIVITY_FILTERS } from '@/console/schemas';
import type { ActivityEntry, ActivityFilters, ActivityQuery } from '@/console/schemas';
import { formatDate, formatInteger, formatTime } from '@/lib/format';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { PageHeader } from '@/ui/PageHeader';
import { ActivityFiltersForm } from './ActivityFiltersForm';
import { ActivityState } from './ActivityState';
import { actorText, entityLabel } from './activityLabels';

const PER_PAGE = 25;

const columns: Column<ActivityEntry>[] = [
  { id: 'time', header: 'Heure', primary: true, cell: (row) => <span className="tabular-nums">{formatTime(row.occurredAt)}</span> },
  {
    id: 'actor',
    header: 'Auteur',
    cell: (row) => (
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">{actorText(row)}</span>
        {row.actor?.email ? <span className="text-caption break-all text-fg-subtle">{row.actor.email}</span> : null}
      </span>
    ),
  },
  {
    id: 'action',
    header: 'Action',
    cell: (row) => (
      <Link href={`/audit/${row.id}`} className="font-mono text-caption font-medium break-all hover:underline">
        {row.action}
      </Link>
    ),
  },
  { id: 'entity', header: 'Entité', cell: (row) => <span className="break-all">{entityLabel(row.subject)}</span> },
  { id: 'origin', header: 'Origine', cell: (row) => <span className="tabular-nums">{row.redacted ? 'Masqué' : (row.ip ?? '—')}</span> },
];

function initialFilters(params: URLSearchParams): ActivityFilters {
  return {
    ...EMPTY_ACTIVITY_FILTERS,
    action: params.get('action') ?? '',
    organization: params.get('organization') ?? '',
    actor: params.get('actor') ?? '',
    requestId: params.get('request_id') ?? '',
    subjectType: params.get('subject_type') ?? '',
    subjectId: params.get('subject_id') ?? '',
  };
}

function toQuery(filters: ActivityFilters, cursor: string | null): ActivityQuery {
  return { ...filters, perPage: PER_PAGE, ...(cursor === null ? {} : { cursor }) };
}

export function ActivityScreen() {
  const params = useSearchParams();
  const [filters, setFilters] = useState<ActivityFilters>(() => initialFilters(params));
  const [cursor, setCursor] = useState<string | null>(null);
  const query = useActivityList(toQuery(filters, cursor));

  const groupLabel = (row: ActivityEntry, previous: ActivityEntry | undefined): string | null =>
    previous && formatDate(previous.occurredAt) === formatDate(row.occurredAt) ? null : formatDate(row.occurredAt);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        title="Journal d’audit"
        subtitle="Qui a fait quoi, quand et d’où, sur toute la plateforme. Les plus récentes d’abord."
      />
      <Alert tone="info">
        Le journal est en ajout seul : aucune entrée ne peut être modifiée ni supprimée. Chaque consultation de la console y est elle-même consignée.
      </Alert>
      <ActivityFiltersForm
        initial={filters}
        onApply={(next) => {
          setFilters(next);
          setCursor(null);
        }}
      />
      <ActivityState query={query} label="Le journal d’audit">
        {(data) =>
          data.rows.length === 0 ? (
            <EmptyState icon={ScrollText} title="Aucune entrée ne correspond" description="Modifiez les filtres ou la période." />
          ) : (
            <>
              <DataTable
                label="Entrées du journal d’audit"
                Link={Link}
                columns={columns}
                rows={data.rows}
                rowKey={(row) => row.id}
                groupLabel={groupLabel}
                rowLink={(row) => ({ href: `/audit/${row.id}`, label: `Ouvrir l’entrée ${row.action}` })}
              />
              <nav aria-label="Pagination du journal" className="flex flex-wrap items-center justify-between gap-2 pt-1 text-caption text-fg-subtle">
                <span aria-live="polite">
                  {formatInteger(data.rows.length)} entrées affichées
                  {data.nextCursor === null ? ', fin du journal' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <IconButton label="Page précédente" icon={ChevronLeft} variant="secondary" disabled={data.prevCursor === null} onClick={() => { setCursor(data.prevCursor); }} />
                  <IconButton label="Page suivante" icon={ChevronRight} variant="secondary" disabled={data.nextCursor === null} onClick={() => { setCursor(data.nextCursor); }} />
                </span>
              </nav>
            </>
          )
        }
      </ActivityState>
    </div>
  );
}
