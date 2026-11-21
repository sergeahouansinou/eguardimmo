'use client';

import { Badge, IconButton, Select } from '@eguardimmo/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { formatDateTime, formatInteger } from '@/lib/format';
import { SUPPORT_ACCESS_STATUSES } from '@/platform/organisations/supportAccesses';
import type { SupportAccess, SupportAccessStatus } from '@/platform/organisations/supportAccesses';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { LoadingBlock, ProblemAlert } from '@/ui/PlatformState';
import { EmptyLine, Section } from '@/ui/Section';
import { useSupportAccesses } from './hooks';
import { ACCESS_KIND_LABELS, ACCESS_STATUS_LABELS, ACCESS_STATUS_TONES, ALL, SCOPE_LABELS } from './labels';

const columns: Column<SupportAccess>[] = [
  { id: 'operator', header: 'Opérateur', primary: true, cell: (row) => row.operator.name ?? 'Opérateur inconnu' },
  { id: 'kind', header: 'Type', cell: (row) => ACCESS_KIND_LABELS[row.kind] ?? row.kind },
  { id: 'status', header: 'Statut', cell: (row) => <Badge tone={ACCESS_STATUS_TONES[row.status] ?? 'neutral'}>{ACCESS_STATUS_LABELS[row.status] ?? row.status}</Badge> },
  { id: 'scopes', header: 'Périmètre', cell: (row) => (row.scopes.length === 0 ? '—' : row.scopes.map((scope) => SCOPE_LABELS[scope] ?? scope).join(', ')) },
  { id: 'duration', header: 'Durée', cell: (row) => (row.durationHours === null ? '—' : `${String(row.durationHours)} h`) },
  { id: 'reason', header: 'Motif', cell: (row) => row.reason ?? <span className="text-fg-subtle">Non communiqué à votre rôle</span> },
  { id: 'granted', header: 'Accordé', cell: (row) => (row.grantedAt === null ? '—' : formatDateTime(row.grantedAt)) },
  { id: 'expires', header: 'Fin', cell: (row) => (row.revokedAt ?? row.expiresAt) === null ? '—' : formatDateTime(row.revokedAt ?? row.expiresAt ?? '') },
  { id: 'reads', header: 'Lectures', align: 'right', cell: (row) => <span className="tabular-nums">{formatInteger(row.readCount)}</span> },
  { id: 'reviewed', header: 'Revue', cell: (row) => (row.kind === 'emergency' ? (row.reviewed ? 'Faite' : 'À faire') : '—') },
];

export function SupportAccessesSection({ organisationId }: { organisationId: string }) {
  const [status, setStatus] = useState(ALL);
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const selected = SUPPORT_ACCESS_STATUSES.find((item): item is SupportAccessStatus => item === status);
  const query = useSupportAccesses(organisationId, { perPage: 10, ...(selected === undefined ? {} : { status: selected }), ...(cursor === undefined ? {} : { cursor }) });

  return (
    <Section
      id="acces-support"
      title="Accès du support"
      aside={
        <div className="w-44">
          <Select
            label="Statut"
            hideLabel
            placeholder="Tous les statuts"
            options={[{ value: ALL, label: 'Tous les statuts' }, ...SUPPORT_ACCESS_STATUSES.map((value) => ({ value, label: ACCESS_STATUS_LABELS[value] ?? value }))]}
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setCursors([]);
            }}
          />
        </div>
      }
    >
      {query.isError ? (
        <ProblemAlert error={query.error} label="Les accès du support" onRetry={query.refetch} />
      ) : query.data === undefined ? (
        <LoadingBlock label="Les accès du support" />
      ) : query.data.rows.length === 0 && cursors.length === 0 ? (
        <EmptyLine>Aucun accès du support ne correspond.</EmptyLine>
      ) : (
        <div className="flex flex-col gap-2">
          <DataTable label="Accès du support" Link={Link} columns={columns} rows={query.data.rows} rowKey={(row) => row.id} />
          <nav aria-label="Pagination des accès du support" className="flex items-center justify-end gap-1">
            <IconButton label="Accès précédents" icon={ChevronLeft} variant="secondary" disabled={cursors.length === 0} onClick={() => { setCursors(cursors.slice(0, -1)); }} />
            <IconButton
              label="Accès suivants"
              icon={ChevronRight}
              variant="secondary"
              disabled={!query.data.hasMore || query.data.nextCursor === null}
              onClick={() => {
                if (query.data?.nextCursor) setCursors([...cursors, query.data.nextCursor]);
              }}
            />
          </nav>
        </div>
      )}
    </Section>
  );
}
