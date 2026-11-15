'use client';

import { Alert, Badge, Button, EmptyState, Select, StatCard, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
import { Puzzle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ExportAuditButton } from '@/features/audit/ExportAuditButton';
import { useModules } from '@/console/hooks/queries';
import { MODULE_GROUP_LABELS } from '@/console/schemas';
import type { ModuleGroup, ModuleRow } from '@/console/schemas';
import { formatDate, formatInteger, formatPercentBp, formatTime } from '@/lib/format';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { QueryState } from '@/ui/QueryState';

const GROUP_OPTIONS = [
  { value: '', label: 'Domaine : Tous' },
  ...(Object.keys(MODULE_GROUP_LABELS) as ModuleGroup[]).map((value) => ({ value, label: MODULE_GROUP_LABELS[value] })),
];

export function ModuleStateBadge({ state }: { state: ModuleRow['state'] }) {
  return <Badge tone={state === 'operational' ? 'success' : 'warning'}>{state === 'operational' ? 'Opérationnel' : 'Dégradé'}</Badge>;
}

const columns: Column<ModuleRow>[] = [
  {
    id: 'name',
    header: 'Module',
    primary: true,
    cell: (row) => (
      <span className="flex flex-col">
        <Link href={`/modules/${row.id}`} className="font-medium hover:underline">
          {row.name}
        </Link>
        <span className="text-caption font-normal text-fg-subtle">{row.description}</span>
      </span>
    ),
  },
  { id: 'version', header: 'Version', cell: (row) => <span className="tabular-nums">{row.version}</span> },
  {
    id: 'orgs',
    header: 'Organisations actives',
    cell: (row) => <span className="tabular-nums">{`${formatInteger(row.organisationsActive)} sur ${formatInteger(row.organisationsTotal)}`}</span>,
  },
  { id: 'state', header: 'État', cell: (row) => <ModuleStateBadge state={row.state} /> },
];

export function ModulesScreen() {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'' | 'operational' | 'degraded'>('');
  const [group, setGroup] = useState('');
  const query = useModules({ q, tab, group });
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        title="Modules"
        subtitle="Les 21 modules de l’API, un par domaine métier. Chaque organisation active ceux de son plan."
        actions={<ExportAuditButton />}
      />
      <QueryState query={query} label="La liste des modules">
        {(data) => (
          <>
            {data.incident ? (
              <Alert tone="warning" title={data.incident.title}>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    Incident ouvert à {formatTime(data.incident.openedAt)} · {formatInteger(data.incident.organisations)} organisations concernées.
                  </span>
                  <Link href={`/sante/incidents/${data.incident.id}`} className="font-medium underline underline-offset-3">
                    Voir l’incident
                  </Link>
                </span>
              </Alert>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Modules" value={formatInteger(data.counts.all)}>
                <span className="text-caption text-fg-subtle">Monolithe Laravel en modules</span>
              </StatCard>
              <StatCard label="Opérationnels" value={formatInteger(data.counts.operational)}>
                <span className="text-caption text-fg-subtle">{formatPercentBp(9994)} de disponibilité</span>
              </StatCard>
              <StatCard label="Dégradés" value={formatInteger(data.counts.degraded)}>
                <span className="text-caption text-fg-subtle">{data.degradedNames.join(', ') || 'Aucun'}</span>
              </StatCard>
              <StatCard label="Version déployée" value={data.deployedVersion}>
                <span className="text-caption text-fg-subtle">Mise en production le {formatDate(data.deployedOn)}</span>
              </StatCard>
            </div>
            <Tabs value={tab} defaultValue="" onValueChange={(value) => { setTab(value as '' | 'operational' | 'degraded'); }}>
              <TabList aria-label="État des modules">
                <Tab value="" count={data.counts.all}>Tous</Tab>
                <Tab value="operational" count={data.counts.operational}>Opérationnels</Tab>
                <Tab value="degraded" count={data.counts.degraded}>Dégradés</Tab>
              </TabList>
              <TabPanel value={tab} className="flex flex-col gap-4">
            <FilterBar label="Filtrer les modules">
              <div className="w-full sm:w-64">
                <TextField
                  label="Rechercher un module"
                  hideLabel
                  type="search"
                  placeholder="Nom du module"
                  value={q}
                  onChange={(event) => { setQ(event.target.value); }}
                />
              </div>
              <Select label="Domaine" hideLabel placeholder="Domaine : Tous" className="w-full sm:w-48" options={GROUP_OPTIONS} value={group} onValueChange={setGroup} />
            </FilterBar>
            {data.rows.length === 0 ? (
              <EmptyState icon={Puzzle} title="Aucun module ne correspond" description="Modifiez la recherche ou les filtres.">
                <Button variant="secondary" onClick={() => { setQ(''); setTab(''); setGroup(''); }}>
                  Effacer les filtres
                </Button>
              </EmptyState>
            ) : (
              <>
                <DataTable
                  label="Modules"
                  Link={Link}
                  columns={columns}
                  rows={data.rows}
                  rowKey={(row) => row.id}
                  rowLink={(row) => ({ href: `/modules/${row.id}`, label: `Ouvrir le module ${row.name}` })}
                />
                <p className="text-caption text-fg-subtle" aria-live="polite">
                  1 à {formatInteger(data.rows.length)} sur {formatInteger(data.rows.length)}
                </p>
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
