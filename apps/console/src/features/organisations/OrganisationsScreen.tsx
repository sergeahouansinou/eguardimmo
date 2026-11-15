'use client';

import { Button, Icon, Select, StatCard, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
import { Building2, Download, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@eguardimmo/ui';
import { useOrganisations, useSubscriptions } from '@/console/hooks/queries';
import { ORGANISATION_TYPE_LABELS, organisationListSchema } from '@/console/schemas';
import type { OrganisationRow, OrganisationState, OrganisationType } from '@/console/schemas';
import { useConsoleSource } from '@/console/source';
import { downloadTextFile } from '@/lib/download';
import { formatDate, formatDayMonth, formatInteger } from '@/lib/format';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { Pagination } from '@/ui/Pagination';
import { QueryState } from '@/ui/QueryState';
import { useNotify } from '@/ui/notify';
import { OrganisationStateBadge } from './labels';

const PAGE_SIZE = 8;

const TYPE_OPTIONS = [
  { value: '', label: 'Type : Tous' },
  ...(Object.keys(ORGANISATION_TYPE_LABELS) as OrganisationType[]).map((value) => ({
    value,
    label: ORGANISATION_TYPE_LABELS[value],
  })),
];
const STATE_OPTIONS = [
  { value: '', label: 'État : Tous' },
  { value: 'active', label: 'Active' },
  { value: 'essai', label: 'En essai' },
  { value: 'suspendue', label: 'Suspendue' },
];

const columns: Column<OrganisationRow>[] = [
  {
    id: 'name',
    header: 'Organisation',
    primary: true,
    cell: (row) => (
      <span className="flex flex-col">
        <Link href={`/organisations/${row.id}`} className="font-medium hover:underline">
          {row.name}
        </Link>
        <span className="text-caption font-normal text-fg-subtle">Créée le {formatDate(row.createdOn)}</span>
      </span>
    ),
  },
  { id: 'type', header: 'Type', cell: (row) => ORGANISATION_TYPE_LABELS[row.type] },
  { id: 'plan', header: 'Plan', cell: (row) => row.planName },
  { id: 'users', header: 'Utilisateurs', align: 'right', cell: (row) => <span className="tabular-nums">{formatInteger(row.userCount)}</span> },
  { id: 'state', header: 'État', cell: (row) => <OrganisationStateBadge row={row} /> },
];

export function OrganisationsScreen() {
  const [q, setQ] = useState('');
  const [type, setType] = useState<OrganisationType | ''>('');
  const [planId, setPlanId] = useState('');
  const [state, setState] = useState<OrganisationState | ''>('');
  const [page, setPage] = useState(1);
  const query = useOrganisations({ q, type, planId, state, page, pageSize: PAGE_SIZE });
  const plans = useSubscriptions();
  const source = useConsoleSource();
  const notify = useNotify();
  const [exporting, setExporting] = useState(false);
  const planOptions = [{ value: '', label: 'Plan : Tous' }, ...(plans.data?.plans ?? []).map((plan) => ({ value: plan.id, label: plan.name }))];

  const change = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: OrganisationRow[] = [];
      for (let next = 1; ; next += 1) {
        const result = organisationListSchema.parse(
          await source.organisations.list({ q, type, planId, state, page: next, pageSize: 100 }),
        );
        rows.push(...result.rows);
        if (rows.length >= result.total || result.rows.length === 0) break;
      }
      const lines = rows.map((row) =>
        [row.name, ORGANISATION_TYPE_LABELS[row.type], row.planName, String(row.userCount), row.state, row.createdOn].join(';'),
      );
      downloadTextFile('organisations.csv', ['Organisation;Type;Plan;Utilisateurs;État;Création', ...lines].join('\n'));
      notify.success('Export prêt', `${String(rows.length)} organisations dans organisations.csv.`);
    } catch {
      notify.error('Export impossible', 'Réessayez dans un instant.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        title="Organisations"
        subtitle={
          query.data
            ? `${formatInteger(query.data.stats.total)} organisations cloisonnées : chacune ne voit que ses propres données. Les locataires sont des profils d’un compte, pas des organisations.`
            : undefined
        }
        actions={
          <>
            <Button variant="secondary" loading={exporting} onClick={() => void exportCsv()}>
              <Icon icon={Download} />
              Exporter
            </Button>
            <Button asChild>
              <Link href="/organisations/nouvelle">
                <Icon icon={Plus} />
                Nouvelle organisation
              </Link>
            </Button>
          </>
        }
      />
      <QueryState query={query} label="La liste des organisations">
        {(data) => (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Organisations" value={formatInteger(data.stats.total)}>
                <span className="text-caption text-fg-subtle">
                  {formatInteger(data.stats.bailleurs)} bailleurs, {formatInteger(data.stats.agences)} agences,{' '}
                  {formatInteger(data.stats.proprietaires)} propriétaires
                </span>
              </StatCard>
              <StatCard label="Actives" value={formatInteger(data.stats.actives)}>
                <span className="text-caption text-fg-subtle">Abonnement en cours ou gratuit</span>
              </StatCard>
              <StatCard label="En essai" value={formatInteger(data.stats.essais)}>
                <span className="text-caption text-fg-subtle">
                  {data.stats.nextTrialEnd ? `Prochaine fin d’essai le ${formatDayMonth(data.stats.nextTrialEnd)}` : 'Aucun essai en cours'}
                </span>
              </StatCard>
              <StatCard label="Suspendues" value={formatInteger(data.stats.suspendues)}>
                <span className="text-caption text-fg-subtle">Accès bloqué, données conservées</span>
              </StatCard>
            </div>
            <Tabs value={type} defaultValue="" onValueChange={(value) => { change(setType)(value as OrganisationType | ''); }}>
              <TabList aria-label="Type d’organisation">
                <Tab value="" count={data.counts.all}>Toutes</Tab>
                <Tab value="bailleur" count={data.counts.bailleur}>Bailleurs</Tab>
                <Tab value="agence" count={data.counts.agence}>Agences sous mandat</Tab>
                <Tab value="proprietaire" count={data.counts.proprietaire}>Propriétaires</Tab>
              </TabList>
              <TabPanel value={type} className="flex flex-col gap-4">
            <FilterBar label="Filtrer les organisations">
              <div className="min-w-56 flex-1">
                <TextField
                  label="Rechercher une organisation"
                  hideLabel
                  type="search"
                  placeholder="Nom de l’organisation, SIREN"
                  value={q}
                  onChange={(event) => { change(setQ)(event.target.value); }}
                />
              </div>
              <Select label="Type" placeholder="Type : Tous" className="w-full sm:w-44" options={TYPE_OPTIONS} value={type} onValueChange={(value) => { change(setType)(value as OrganisationType | ''); }} hideLabel />
              <Select label="Plan" placeholder="Plan : Tous" className="w-full sm:w-40" options={planOptions} value={planId} onValueChange={change(setPlanId)} hideLabel />
              <Select label="État" placeholder="État : Tous" className="w-full sm:w-40" options={STATE_OPTIONS} value={state} onValueChange={(value) => { change(setState)(value as OrganisationState | ''); }} hideLabel />
            </FilterBar>
            {data.rows.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="Aucune organisation ne correspond"
                description="Modifiez la recherche ou les filtres pour élargir la liste."
              >
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQ('');
                    setType('');
                    setPlanId('');
                    setState('');
                    setPage(1);
                  }}
                >
                  Effacer les filtres
                </Button>
              </EmptyState>
            ) : (
              <>
                <DataTable
                  label="Organisations"
                  Link={Link}
                  columns={columns}
                  rows={data.rows}
                  rowKey={(row) => row.id}
                  rowLink={(row) => ({ href: `/organisations/${row.id}`, label: `Ouvrir ${row.name}` })}
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
