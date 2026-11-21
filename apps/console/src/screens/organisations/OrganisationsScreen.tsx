'use client';

import { Badge, EmptyState, IconButton } from '@eguardimmo/ui';
import { Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { formatDate, formatInteger } from '@/lib/format';
import type { Organisation } from '@/platform/organisations/organisations';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { PageHeader } from '@/ui/PageHeader';
import { PlatformState } from '@/ui/PlatformState';
import { useOrganisations } from './hooks';
import { OrganisationFilters, EMPTY_FILTERS, toOrganisationQuery } from './OrganisationFilters';
import type { OrganisationFilterValues } from './OrganisationFilters';
import { KIND_LABELS, SUBSCRIPTION_LABELS, SUBSCRIPTION_TONES } from './labels';

const PER_PAGE = 25;

const columns: Column<Organisation>[] = [
  { id: 'name', header: 'Organisation', primary: true, cell: (row) => <Link href={`/organisations/${row.id}`} className="inline-flex min-h-6 items-center font-medium break-words hover:underline">{row.name}</Link> },
  { id: 'kind', header: 'Type', cell: (row) => KIND_LABELS[row.kind] ?? row.kind },
  { id: 'country', header: 'Pays', cell: (row) => row.country },
  { id: 'created', header: 'Création', cell: (row) => formatDate(row.createdAt) },
  { id: 'state', header: 'État', cell: (row) => <Badge tone={row.state === 'suspended' ? 'danger' : 'success'}>{row.state === 'suspended' ? 'Suspendue' : 'Active'}</Badge> },
  { id: 'plan', header: 'Plan', cell: (row) => row.plan ?? '—' },
  {
    id: 'subscription',
    header: 'Abonnement',
    cell: (row) => (row.subscriptionStatus === null ? '—' : <Badge tone={SUBSCRIPTION_TONES[row.subscriptionStatus] ?? 'neutral'}>{SUBSCRIPTION_LABELS[row.subscriptionStatus] ?? row.subscriptionStatus}</Badge>),
  },
  { id: 'members', header: 'Membres', align: 'right', cell: (row) => <span className="tabular-nums">{formatInteger(row.membersCount)}</span> },
];

export function OrganisationsScreen() {
  const [filters, setFilters] = useState<OrganisationFilterValues>(EMPTY_FILTERS);
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const query = useOrganisations({ ...toOrganisationQuery(filters), perPage: PER_PAGE, ...(cursor === undefined ? {} : { cursor }) });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader Link={Link} title="Organisations" subtitle="Agences et particuliers clients de la plateforme. Lecture seule : l’équipe, les réglages et les données restent celles de l’organisation." />
      <OrganisationFilters
        onApply={(values) => {
          setFilters(values);
          setCursors([]);
        }}
      />
      <PlatformState query={query} label="La liste des organisations">
        {(page) =>
          page.rows.length === 0 && cursors.length === 0 ? (
            <EmptyState icon={Building2} title="Aucune organisation ne correspond" description="Modifiez les filtres ou la recherche." />
          ) : (
            <>
              <DataTable label="Organisations" Link={Link} columns={columns} rows={page.rows} rowKey={(row) => row.id} rowLink={(row) => ({ href: `/organisations/${row.id}`, label: `Ouvrir la fiche de ${row.name}` })} />
              <nav aria-label="Pagination des organisations" className="flex flex-wrap items-center justify-between gap-2 pt-1 text-caption text-fg-subtle">
                <span aria-live="polite">
                  {formatInteger(page.rows.length)} organisations affichées
                  {page.hasMore ? '' : ', fin de la liste'}
                </span>
                <span className="flex items-center gap-1">
                  <IconButton label="Page précédente" icon={ChevronLeft} variant="secondary" disabled={cursors.length === 0} onClick={() => { setCursors(cursors.slice(0, -1)); }} />
                  <IconButton
                    label="Page suivante"
                    icon={ChevronRight}
                    variant="secondary"
                    disabled={!page.hasMore || page.nextCursor === null}
                    onClick={() => {
                      if (page.nextCursor !== null) setCursors([...cursors, page.nextCursor]);
                    }}
                  />
                </span>
              </nav>
            </>
          )
        }
      </PlatformState>
    </div>
  );
}
