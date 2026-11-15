'use client';

import { Alert, Badge, Button, EmptyState, Select, StatCard, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ExportAuditButton } from '@/features/audit/ExportAuditButton';
import { useRgpdList } from '@/console/hooks/queries';
import { RGPD_STATE_LABELS, RGPD_TYPE_LABELS } from '@/console/schemas';
import type { RgpdRow, RgpdState, RgpdType } from '@/console/schemas';
import { formatDate, formatDayMonth, formatInteger } from '@/lib/format';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { Pagination } from '@/ui/Pagination';
import { QueryState } from '@/ui/QueryState';

const PAGE_SIZE = 6;

const TYPE_OPTIONS = [
  { value: '', label: 'Type : Tous' },
  ...(Object.keys(RGPD_TYPE_LABELS) as RgpdType[]).map((value) => ({ value, label: RGPD_TYPE_LABELS[value] })),
];

export function RgpdStateBadge({ state }: { state: RgpdState }) {
  const tone = state === 'cloturee' ? 'success' : state === 'en_cours' ? 'info' : 'warning';
  return <Badge tone={tone}>{RGPD_STATE_LABELS[state]}</Badge>;
}

export function deadlineLabel(row: Pick<RgpdRow, 'daysLeft' | 'closedOn' | 'state'>): string {
  if (row.state === 'cloturee') return row.closedOn ? `Clôturée le ${formatDayMonth(row.closedOn)}` : 'Clôturée';
  if (row.daysLeft === null) return '';
  if (row.daysLeft < 0) return `en retard de ${formatInteger(-row.daysLeft)} jours`;
  return `dans ${formatInteger(row.daysLeft)} jours`;
}

const columns: Column<RgpdRow>[] = [
  {
    id: 'requester',
    header: 'Demandeur',
    primary: true,
    cell: (row) => (
      <span className="flex flex-col">
        <Link href={`/rgpd/${row.id}`} className="font-medium hover:underline">
          {row.requester}
        </Link>
        <span className="text-caption font-normal text-fg-subtle">{RGPD_TYPE_LABELS[row.type]}</span>
      </span>
    ),
  },
  { id: 'organisation', header: 'Organisation', cell: (row) => row.organisationName },
  { id: 'received', header: 'Reçue le', cell: (row) => <span className="tabular-nums">{formatDate(row.receivedOn)}</span> },
  {
    id: 'due',
    header: 'Échéance',
    cell: (row) => (
      <span className="flex flex-col">
        <span className="tabular-nums">{row.state === 'cloturee' ? '—' : formatDate(row.dueOn)}</span>
        <span className="text-caption text-fg-subtle">{deadlineLabel(row)}</span>
      </span>
    ),
  },
  { id: 'state', header: 'État', cell: (row) => <RgpdStateBadge state={row.state} /> },
];

export function RgpdScreen() {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<RgpdState | ''>('');
  const [type, setType] = useState<RgpdType | ''>('');
  const [organisationId, setOrganisationId] = useState('');
  const [page, setPage] = useState(1);
  const query = useRgpdList({ q, state: tab, type, organisationId, page, pageSize: PAGE_SIZE });
  const reset = () => {
    setQ('');
    setTab('');
    setType('');
    setOrganisationId('');
    setPage(1);
  };
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        title="Conformité RGPD"
        subtitle="Demandes d’accès, d’effacement et de rectification. Délai légal : un mois."
        actions={<ExportAuditButton query={{ type: 'rgpd' }} />}
      />
      <QueryState query={query} label="Le registre RGPD">
        {(data) => (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="À traiter" value={formatInteger(data.stats.toProcess)}>
                <span className="text-caption text-fg-subtle">
                  {data.stats.nearestDue ? `Plus proche : ${formatDate(data.stats.nearestDue)}` : 'Aucune échéance'}
                </span>
              </StatCard>
              <StatCard label="En cours" value={formatInteger(data.stats.inProgress)}>
                <span className="text-caption text-fg-subtle">Pièces à réunir</span>
              </StatCard>
              <StatCard label="Clôturées, 12 mois" value={formatInteger(data.stats.closed)}>
                <span className="text-caption text-fg-subtle">Toutes dans le délai</span>
              </StatCard>
              <StatCard label="Délai moyen" value={`${formatInteger(data.stats.averageDays)} jours`}>
                <span className="text-caption text-fg-subtle">Objectif : 30 jours</span>
              </StatCard>
            </div>
            <Alert tone="info">
              Le registre des demandes est conservé 5 ans. L’identité du demandeur est vérifiée avant toute réponse. Les données ne sont ouvertes que sur
              accès justifié et consigné.
            </Alert>
            <Tabs
              value={tab}
              defaultValue=""
              onValueChange={(value) => {
                setTab(value as RgpdState | '');
                setPage(1);
              }}
            >
              <TabList aria-label="État des demandes">
                <Tab value="" count={data.counts.all}>Toutes</Tab>
                <Tab value="a_traiter" count={data.counts.a_traiter}>À traiter</Tab>
                <Tab value="en_cours" count={data.counts.en_cours}>En cours</Tab>
                <Tab value="cloturee" count={data.counts.cloturee}>Clôturées</Tab>
              </TabList>
              <TabPanel value={tab} className="flex flex-col gap-4">
            <FilterBar label="Filtrer les demandes">
              <div className="min-w-56 flex-1">
                <TextField
                  label="Rechercher un demandeur"
                  hideLabel
                  type="search"
                  placeholder="Nom du demandeur"
                  value={q}
                  onChange={(event) => {
                    setQ(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <Select
                label="Type"
                hideLabel
                placeholder="Type : Tous"
                className="w-full sm:w-52"
                options={TYPE_OPTIONS}
                value={type}
                onValueChange={(value) => {
                  setType(value as RgpdType | '');
                  setPage(1);
                }}
              />
              <Select
                label="Organisation"
                hideLabel
                placeholder="Organisation : Toutes"
                className="w-full sm:w-56"
                options={[{ value: '', label: 'Organisation : Toutes' }, ...data.organisations.map((org) => ({ value: org.id, label: org.name }))]}
                value={organisationId}
                onValueChange={(value) => {
                  setOrganisationId(value);
                  setPage(1);
                }}
              />
            </FilterBar>
            {data.rows.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="Aucune demande ne correspond" description="Modifiez la recherche ou les filtres.">
                <Button variant="secondary" onClick={reset}>
                  Effacer les filtres
                </Button>
              </EmptyState>
            ) : (
              <>
                <DataTable
                  label="Demandes RGPD"
                  Link={Link}
                  columns={columns}
                  rows={data.rows}
                  rowKey={(row) => row.id}
                  rowLink={(row) => ({ href: `/rgpd/${row.id}`, label: `Ouvrir la demande de ${row.requester}` })}
                />
                <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
              </>
            )}
              </TabPanel>
            </Tabs>
          </>
        )}
      </QueryState>
    </div>
  );
}
