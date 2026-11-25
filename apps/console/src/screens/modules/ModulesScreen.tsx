'use client';

import { Badge, EmptyState, Select, TextField } from '@eguardimmo/ui';
import { Puzzle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { usePlans } from '@/screens/abonnements/hooks';
import { GROUP_LABELS } from '@/screens/organisations/labels';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { PlatformState } from '@/ui/PlatformState';
import { GROUP_ORDER, buildRegistry, filterRegistry, includedIn } from './registry';
import type { FeatureRow } from './registry';

const ALL = 'all';

const href = (row: FeatureRow) => `/modules/${encodeURIComponent(row.feature)}`;

const columns: Column<FeatureRow>[] = [
  {
    id: 'feature',
    header: 'Fonction',
    primary: true,
    cell: (row) => (
      <Link href={href(row)} className="flex flex-col hover:underline">
        <span className="font-medium">{row.label}</span>
        <span className="font-mono text-caption font-normal text-fg-subtle">{row.feature}</span>
      </Link>
    ),
  },
  { id: 'group', header: 'Groupe', cell: (row) => GROUP_LABELS[row.group] ?? row.group },
  { id: 'kind', header: 'Type', cell: (row) => (row.kind === 'quota' ? 'Quota' : 'Fonction') },
  {
    id: 'plans',
    header: 'Plans qui l’incluent',
    cell: (row) => {
      const included = includedIn(row);
      return included.length === 0 ? (
        <span className="text-fg-subtle">Aucun plan</span>
      ) : (
        <span className="flex flex-wrap gap-1">
          {included.map((plan) => (
            <Badge key={plan.code} tone="neutral">
              {plan.name}
            </Badge>
          ))}
        </span>
      );
    },
  },
];

export function ModulesScreen() {
  const plans = usePlans();
  const [group, setGroup] = useState('');
  const [search, setSearch] = useState('');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader Link={Link} title="Modules" subtitle="Fonctions de la plateforme et plans qui les incluent, d’après les versions publiées." />
      <FilterBar label="Filtrer les modules">
        <div className="w-full sm:w-64">
          <TextField label="Fonction" placeholder="Ex. baux" value={search} onChange={(event) => { setSearch(event.target.value); }} />
        </div>
        <div className="w-full sm:w-48">
          <Select
            label="Groupe"
            placeholder="Tous les groupes"
            value={group === '' ? ALL : group}
            options={[{ value: ALL, label: 'Tous les groupes' }, ...GROUP_ORDER.map((value) => ({ value, label: GROUP_LABELS[value] ?? value }))]}
            onValueChange={(value) => { setGroup(value === ALL ? '' : value); }}
          />
        </div>
      </FilterBar>
      <PlatformState query={plans} label="Les modules">
        {(list) => {
          const registry = buildRegistry(list);
          const rows = filterRegistry(registry, { group, search });
          if (registry.length === 0) {
            return <EmptyState icon={Puzzle} title="Aucun module" description="Aucun plan n’a de version publiée : le registre des fonctions est vide." />;
          }
          if (rows.length === 0) {
            return <EmptyState icon={Puzzle} title="Aucun résultat" description="Aucune fonction ne correspond à ces filtres." />;
          }
          return <DataTable label="Modules" columns={columns} rows={rows} rowKey={(row) => row.feature} rowLink={(row) => ({ href: href(row), label: `Ouvrir le module ${row.label}` })} Link={Link} />;
        }}
      </PlatformState>
    </div>
  );
}
