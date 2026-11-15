'use client';

import { Alert, Badge, Button, Chip, EmptyState, Icon, Select, TextField } from '@eguardimmo/ui';
import { ScrollText } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useAuditList, useOverview } from '@/console/hooks/queries';
import { AUDIT_TYPE_LABELS, AUDIT_TYPE_TONES } from '@/console/schemas';
import type { AuditRow, AuditType } from '@/console/schemas';
import { dayKey, daysBetween, formatDate, formatInteger, formatTime } from '@/lib/format';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { Pagination } from '@/ui/Pagination';
import { QueryState } from '@/ui/QueryState';
import { ExportAuditButton } from './ExportAuditButton';

const PAGE_SIZE = 7;

const TYPE_OPTIONS = [
  { value: '', label: 'Type : Tous' },
  ...(Object.keys(AUDIT_TYPE_LABELS) as AuditType[]).map((value) => ({ value, label: AUDIT_TYPE_LABELS[value] })),
];

const columns: Column<AuditRow>[] = [
  { id: 'time', header: 'Heure', primary: true, cell: (row) => <span className="tabular-nums">{formatTime(row.at)}</span> },
  {
    id: 'actor',
    header: 'Acteur',
    cell: (row) => (
      <span className="flex flex-col">
        <span className="font-medium">{row.actor.name}</span>
        <span className="text-caption text-fg-subtle">{row.actor.role}</span>
      </span>
    ),
  },
  { id: 'type', header: 'Type', cell: (row) => <Badge tone={AUDIT_TYPE_TONES[row.type]}>{AUDIT_TYPE_LABELS[row.type]}</Badge> },
  {
    id: 'action',
    header: 'Action',
    cell: (row) => (
      <span className="flex min-w-0 flex-col">
        <Link href={`/audit/${row.id}`} className="font-medium hover:underline">
          {row.title}
        </Link>
        <span className="text-caption text-fg-subtle">{row.context}</span>
      </span>
    ),
  },
  { id: 'origin', header: 'Origine', cell: (row) => <span className="tabular-nums">{row.origin}</span> },
];

export function AuditScreen() {
  const initialOrganisation = useSearchParams().get('organisation') ?? '';
  const [q, setQ] = useState('');
  const [type, setType] = useState<AuditType | ''>('');
  const [organisationId, setOrganisationId] = useState(initialOrganisation);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [justifiedOnly, setJustifiedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const overview = useOverview();
  const today = overview.data ? dayKey(overview.data.generatedAt) : null;
  const filters = { q, type, organisationId, from, to, justifiedOnly };
  const query = useAuditList({ ...filters, page, pageSize: PAGE_SIZE });
  const rangeInvalid = from !== '' && to !== '' && from > to;
  const change = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };
  const reset = () => {
    setQ('');
    setType('');
    setOrganisationId('');
    setFrom('');
    setTo('');
    setJustifiedOnly(false);
    setPage(1);
  };
  const groupLabel = (row: AuditRow, previous: AuditRow | undefined): string | null => {
    const day = dayKey(row.at);
    if (previous && dayKey(previous.at) === day) return null;
    const offset = today ? daysBetween(`${day}T12:00:00Z`, `${today}T12:00:00Z`) : null;
    const prefix = offset === 0 ? 'Aujourd’hui, ' : offset === 1 ? 'Hier, ' : '';
    return `${prefix}${formatDate(row.at)}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        title="Journal d’audit"
        subtitle="Connexions, droits, exports, accès justifiés et configuration, de toute la plateforme."
        actions={<ExportAuditButton query={filters} />}
      />
      <Alert tone="info">
        Le journal est horodaté et chaîné par empreinte. Il ne peut être ni modifié ni supprimé, y compris par l’équipe opérateur. Conservation : 5 ans.
      </Alert>
      <FilterBar label="Filtrer le journal">
        <div className="w-full sm:w-64">
          <TextField
            label="Rechercher dans le journal"
            hideLabel
            type="search"
            placeholder="Action, acteur, organisation"
            value={q}
            onChange={(event) => { change(setQ)(event.target.value); }}
          />
        </div>
        <TextField label="Du" type="date" placeholder="2026-11-01" value={from} onChange={(event) => { change(setFrom)(event.target.value); }} error={rangeInvalid ? 'Début après la fin.' : undefined} />
        <TextField label="Au" type="date" placeholder="2026-11-13" value={to} onChange={(event) => { change(setTo)(event.target.value); }} />
        <Select label="Type" hideLabel placeholder="Type : Tous" className="w-full sm:w-44" options={TYPE_OPTIONS} value={type} onValueChange={(value) => { change(setType)(value as AuditType | ''); }} />
        <OrganisationSelect value={organisationId} onChange={change(setOrganisationId)} organisations={query.data?.organisations ?? []} />
        <Chip pressed={justifiedOnly} onClick={() => { change(setJustifiedOnly)(!justifiedOnly); }}>
          Accès justifiés uniquement
        </Chip>
      </FilterBar>
      <QueryState query={query} label="Le journal d’audit">
        {(data) =>
          data.rows.length === 0 ? (
            <EmptyState icon={ScrollText} title="Aucun événement ne correspond" description="Modifiez la recherche, la période ou les filtres.">
              <Button variant="secondary" onClick={reset}>
                <Icon icon={ScrollText} />
                Effacer les filtres
              </Button>
            </EmptyState>
          ) : (
            <>
              <DataTable
                label="Événements du journal"
                Link={Link}
                columns={columns}
                rows={data.rows}
                rowKey={(row) => row.id}
                groupLabel={groupLabel}
                rowLink={(row) => ({ href: `/audit/${row.id}`, label: `Ouvrir l’événement ${row.reference}` })}
              />
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
              <span className="sr-only" aria-live="polite">{`${formatInteger(data.total)} événements`}</span>
            </>
          )
        }
      </QueryState>
    </div>
  );
}

function OrganisationSelect({
  value,
  onChange,
  organisations,
}: {
  value: string;
  onChange: (value: string) => void;
  organisations: { id: string; name: string }[];
}) {
  return (
    <Select
      label="Organisation"
      hideLabel
      placeholder="Organisation : Toutes"
      className="w-full sm:w-56"
      searchable
      searchPlaceholder="Rechercher une organisation"
      options={[{ value: '', label: 'Organisation : Toutes' }, ...organisations.map((org) => ({ value: org.id, label: org.name }))]}
      value={value}
      onValueChange={onChange}
    />
  );
}
