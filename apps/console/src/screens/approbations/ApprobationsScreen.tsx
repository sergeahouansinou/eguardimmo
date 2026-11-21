'use client';

import { Alert, Badge, Checkbox, EmptyState, IconButton, Select } from '@eguardimmo/ui';
import { ChevronLeft, ChevronRight, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useOperator } from '@/espace/useOperator';
import { formatDateTime, formatInteger } from '@/lib/format';
import { usePlatformQuery } from '@/platform/context';
import { APPROVAL_ACTIONS, APPROVAL_STATUSES } from '@/platform/approvals/approvals';
import type { Approval, ApprovalQuery, ApprovalStatus } from '@/platform/approvals/approvals';
import { APPROVAL_ACTION_LABELS, APPROVAL_STATUS_LABELS, APPROVAL_STATUS_TONES, labelOf } from '@/platform/labels';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { PlatformState } from '@/ui/PlatformState';
import { ApprovalDetailDialog } from './ApprovalDetailDialog';
import { isOwnPending, subjectTypeLabel } from './approvalView';

const PER_PAGE = 25;
const ALL = 'all';

const STATUS_OPTIONS = [{ value: ALL, label: 'Statut : tous' }, ...APPROVAL_STATUSES.map((value) => ({ value, label: APPROVAL_STATUS_LABELS[value] }))];
const ACTION_OPTIONS = [{ value: ALL, label: 'Action : toutes' }, ...APPROVAL_ACTIONS.map((value) => ({ value, label: labelOf(APPROVAL_ACTION_LABELS, value) }))];

function buildQuery(status: string, action: string, mine: boolean, cursor: string | undefined): ApprovalQuery {
  return {
    perPage: PER_PAGE,
    ...(status === ALL ? {} : { status: status as ApprovalStatus }),
    ...(action === ALL ? {} : { action }),
    ...(mine ? { mine: true } : {}),
    ...(cursor === undefined ? {} : { cursor }),
  };
}

export function ApprobationsScreen() {
  const operator = useOperator();
  const [status, setStatus] = useState<string>('pending');
  const [action, setAction] = useState<string>(ALL);
  const [mine, setMine] = useState(false);
  const [cursors, setCursors] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cursor = cursors.at(-1);
  const query = usePlatformQuery(['approvals', 'list', status, action, mine, cursor ?? ''], (api) => api.approvals.list(buildQuery(status, action, mine, cursor)), { keepPrevious: true });
  const operatorId = operator.data?.id;

  const filter = (change: () => void) => {
    change();
    setCursors([]);
  };

  const columns: Column<Approval>[] = [
    { id: 'action', header: 'Action', primary: true, cell: (row) => labelOf(APPROVAL_ACTION_LABELS, row.action) },
    { id: 'subject', header: 'Sujet', cell: (row) => subjectTypeLabel(row.subjectType) },
    {
      id: 'status',
      header: 'Statut',
      cell: (row) => (
        <span className="flex flex-col items-start gap-1">
          <Badge tone={APPROVAL_STATUS_TONES[row.status]} wrap>
            {APPROVAL_STATUS_LABELS[row.status]}
          </Badge>
          {isOwnPending(row, operatorId) ? <span className="text-caption text-fg-subtle">Votre demande</span> : null}
        </span>
      ),
    },
    { id: 'requester', header: 'Demandeur', cell: (row) => row.requestedBy.name ?? 'Opérateur' },
    { id: 'created', header: 'Créée', cell: (row) => <span className="tabular-nums">{formatDateTime(row.createdAt)}</span> },
    { id: 'expires', header: 'Expire', cell: (row) => <span className="tabular-nums">{formatDateTime(row.expiresAt)}</span> },
    {
      id: 'open',
      header: 'Détail',
      cell: (row) => (
        <button
          type="button"
          className="min-h-6 rounded-sm px-1 text-action underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          onClick={() => { setSelectedId(row.id); }}
        >
          Ouvrir<span className="sr-only"> la demande : {labelOf(APPROVAL_ACTION_LABELS, row.action)}</span>
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        title="Approbations"
        subtitle="Les actions sensibles exigent la validation d’un second opérateur. Vous ne validez jamais votre propre demande."
        breadcrumb={[{ label: 'Vue d’ensemble', href: '/' }, { label: 'Approbations' }]}
      />
      <FilterBar label="Filtrer les demandes">
        <Select label="Statut" hideLabel placeholder="Statut" className="w-full sm:w-64" options={STATUS_OPTIONS} value={status} onValueChange={(value) => { filter(() => { setStatus(value); }); }} />
        <Select label="Action" hideLabel placeholder="Action" className="w-full sm:w-72" options={ACTION_OPTIONS} value={action} onValueChange={(value) => { filter(() => { setAction(value); }); }} />
        <Checkbox label="Mes demandes" checked={mine} onChange={(event) => { filter(() => { setMine(event.target.checked); }); }} />
      </FilterBar>
      <PlatformState query={query} label="Les approbations">
        {(data) => (
          <>
            {data.pendingCount > 0 ? (
              <Alert tone="info">
                {formatInteger(data.pendingCount)} {data.pendingCount > 1 ? 'demandes attendent' : 'demande attend'} une validation.
              </Alert>
            ) : null}
            {data.rows.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="Aucune demande ne correspond" description="Modifiez les filtres pour élargir la liste." />
            ) : (
              <>
                <DataTable label="Demandes d’approbation" Link={Link} columns={columns} rows={data.rows} rowKey={(row) => row.id} />
                <nav aria-label="Pagination des demandes" className="flex flex-wrap items-center justify-between gap-2 pt-1 text-caption text-fg-subtle">
                  <span aria-live="polite">
                    {formatInteger(data.rows.length)} demandes affichées{data.hasMore ? '' : ', fin de la liste'}
                  </span>
                  <span className="flex items-center gap-1">
                    <IconButton label="Page précédente" icon={ChevronLeft} variant="secondary" disabled={cursors.length === 0} onClick={() => { setCursors((previous) => previous.slice(0, -1)); }} />
                    <IconButton
                      label="Page suivante"
                      icon={ChevronRight}
                      variant="secondary"
                      disabled={!data.hasMore || data.nextCursor === null}
                      onClick={() => { if (data.nextCursor !== null) setCursors((previous) => [...previous, data.nextCursor ?? '']); }}
                    />
                  </span>
                </nav>
                <ApprovalDetailDialog approval={data.rows.find((row) => row.id === selectedId) ?? null} operatorId={operatorId} onClose={() => { setSelectedId(null); }} />
              </>
            )}
          </>
        )}
      </PlatformState>
    </div>
  );
}
