'use client';

import { Badge, Button, EmptyState, Select, StatCard } from '@eguardimmo/ui';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useOperator } from '@/espace/useOperator';
import { formatDate, formatInteger } from '@/lib/format';
import { REQUEST_KINDS, REQUEST_STATUSES } from '@/platform/privacy/privacy';
import type { PrivacyQuery, PrivacyRequest, RequestKind, RequestStatus } from '@/platform/privacy/privacy';
import { hasRole } from '@/platform/roles';
import { CursorPager } from '@/screens/abonnements/CursorPager';
import { useCursorPaging } from '@/screens/abonnements/useCursorPaging';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { PlatformState } from '@/ui/PlatformState';
import { usePrivacyRequests } from './hooks';
import { CHANNEL_LABELS, KIND_LABELS, STATUS_LABELS, STATUS_TONES } from './labels';
import { RecordRequestDialog } from './RecordRequestDialog';

const PER_PAGE = 25;
const ALL = 'all';
const OVERDUE = 'overdue';

const columns: Column<PrivacyRequest>[] = [
  {
    id: 'requester',
    header: 'Demandeur',
    primary: true,
    cell: (row) => (
      <Link href={`/rgpd/${encodeURIComponent(row.id)}`} className="inline-flex min-h-6 items-center font-medium break-words hover:underline">
        {row.requester.name ?? row.requester.email ?? 'Demandeur sans compte'}
      </Link>
    ),
  },
  { id: 'kind', header: 'Type', cell: (row) => KIND_LABELS[row.kind] ?? row.kind },
  { id: 'channel', header: 'Canal', cell: (row) => CHANNEL_LABELS[row.channel] ?? row.channel },
  { id: 'status', header: 'Statut', cell: (row) => <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge> },
  { id: 'received', header: 'Reçue le', cell: (row) => formatDate(row.receivedAt) },
  {
    id: 'deadline',
    header: 'Échéance',
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1.5">
        {formatDate(row.deadline)}
        {row.overdue ? <Badge tone="danger">En retard</Badge> : null}
      </span>
    ),
  },
];

export function RgpdScreen() {
  const operator = useOperator();
  const canWrite = operator.data !== undefined && hasRole(operator.data.roles, 'compliance');
  const paging = useCursorPaging();
  const [status, setStatus] = useState<RequestStatus | ''>('');
  const [kind, setKind] = useState<RequestKind | ''>('');
  const [overdue, setOverdue] = useState(false);
  const [recording, setRecording] = useState(false);
  const query: PrivacyQuery = {
    perPage: PER_PAGE,
    cursor: paging.cursor,
    ...(status === '' ? {} : { status }),
    ...(kind === '' ? {} : { kind }),
    ...(overdue ? { overdue: true } : {}),
  };
  const result = usePrivacyRequests(query);
  const filtered = (apply: () => void) => {
    apply();
    paging.reset();
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        title="Conformité RGPD"
        subtitle="Demandes d’exercice des droits des personnes et délais de réponse."
        actions={canWrite ? <Button onClick={() => { setRecording(true); }}>Enregistrer une demande</Button> : undefined}
      />
      {result.data ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard label="Demandes ouvertes" value={formatInteger(result.data.openCount)} />
          <StatCard label="Demandes en retard" value={formatInteger(result.data.overdueCount)} tone={result.data.overdueCount > 0 ? 'danger' : 'default'} />
        </div>
      ) : null}
      <FilterBar label="Filtrer les demandes">
        <div className="w-full sm:w-52">
          <Select
            label="Statut"
            placeholder="Tous les statuts"
            value={status === '' ? ALL : status}
            options={[{ value: ALL, label: 'Tous les statuts' }, ...REQUEST_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))]}
            onValueChange={(value) => { filtered(() => { setStatus(REQUEST_STATUSES.find((candidate) => candidate === value) ?? ''); }); }}
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            label="Type"
            placeholder="Tous les types"
            value={kind === '' ? ALL : kind}
            options={[{ value: ALL, label: 'Tous les types' }, ...REQUEST_KINDS.map((value) => ({ value, label: KIND_LABELS[value] ?? value }))]}
            onValueChange={(value) => { filtered(() => { setKind(REQUEST_KINDS.find((candidate) => candidate === value) ?? ''); }); }}
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            label="Délai"
            placeholder="Tous les délais"
            value={overdue ? OVERDUE : ALL}
            options={[{ value: ALL, label: 'Tous les délais' }, { value: OVERDUE, label: 'En retard uniquement' }]}
            onValueChange={(value) => { filtered(() => { setOverdue(value === OVERDUE); }); }}
          />
        </div>
      </FilterBar>
      <PlatformState query={result} label="Les demandes RGPD">
        {(page) =>
          page.rows.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Aucune demande" description="Aucune demande ne correspond à ces filtres." />
          ) : (
            <>
              <DataTable
                label="Demandes RGPD"
                columns={columns}
                rows={page.rows}
                rowKey={(row) => row.id}
                Link={Link}
                rowLink={(row) => ({ href: `/rgpd/${encodeURIComponent(row.id)}`, label: `Ouvrir la demande de ${row.requester.name ?? row.requester.email ?? 'un demandeur sans compte'}` })}
              />
              <CursorPager paging={paging} hasMore={page.hasMore} nextCursor={page.nextCursor} />
            </>
          )
        }
      </PlatformState>
      <RecordRequestDialog open={recording} onOpenChange={setRecording} />
    </div>
  );
}
