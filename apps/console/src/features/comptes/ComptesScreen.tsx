'use client';

import { Badge, Button, EmptyState, Select, StatCard, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
import { Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useAccounts } from '@/console/hooks/queries';
import { PROFILE_LABELS } from '@/console/schemas';
import type { AccountRow, AccountState, ProfileKind } from '@/console/schemas';
import { formatDateTime, formatDayMonth, formatInteger, plural } from '@/lib/format';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { Pagination } from '@/ui/Pagination';
import { QueryState } from '@/ui/QueryState';
import { ExportAccountsButton } from './ExportAccountsButton';

const PAGE_SIZE = 8;

const PROFILE_OPTIONS = [
  { value: '', label: 'Profil : Tous' },
  ...(Object.keys(PROFILE_LABELS) as ProfileKind[]).map((value) => ({ value, label: PROFILE_LABELS[value] })),
];
const TWO_FACTOR_OPTIONS = [
  { value: '', label: 'Double auth. : Tous' },
  { value: 'avec', label: 'Avec 2FA' },
  { value: 'sans', label: 'Sans 2FA' },
];

export function AccountStateBadge({ state }: { state: AccountState }) {
  if (state === 'suspendu') return <Badge tone="danger">Suspendu</Badge>;
  if (state === 'invite') return <Badge tone="info">Invité</Badge>;
  return <Badge tone="success">Actif</Badge>;
}

const columns: Column<AccountRow>[] = [
  {
    id: 'account',
    header: 'Compte',
    primary: true,
    cell: (row) => (
      <span className="flex min-w-0 flex-col">
        <Link href={`/comptes/${row.id}`} className="font-medium hover:underline">
          {row.name}
        </Link>
        <span className="text-caption font-normal break-all text-fg-subtle">{row.email}</span>
      </span>
    ),
  },
  {
    id: 'profiles',
    header: 'Profils',
    cell: (row) => (
      <span className="flex flex-col">
        <span>{plural(row.profiles.length, 'profil')}</span>
        <span className="text-caption text-fg-subtle">{row.profiles.map((kind) => PROFILE_LABELS[kind].toLowerCase()).join(', ')}</span>
      </span>
    ),
  },
  {
    id: 'twofactor',
    header: 'Double auth.',
    cell: (row) => <Badge tone={row.twoFactor ? 'success' : 'neutral'}>{row.twoFactor ? '2FA' : 'Sans 2FA'}</Badge>,
  },
  {
    id: 'login',
    header: 'Dernière connexion',
    cell: (row) => (
      <span className="flex flex-col">
        <span>{row.lastLoginAt ? formatDateTime(row.lastLoginAt) : 'Jamais'}</span>
        {row.invitedOn && row.state === 'invite' ? (
          <span className="text-caption text-fg-subtle">Invitation du {formatDayMonth(row.invitedOn)}</span>
        ) : null}
      </span>
    ),
  },
  { id: 'state', header: 'État', cell: (row) => <AccountStateBadge state={row.state} /> },
];

export function ComptesScreen() {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<AccountState | ''>('');
  const [profile, setProfile] = useState<ProfileKind | ''>('');
  const [twoFactor, setTwoFactor] = useState<'' | 'avec' | 'sans'>('');
  const [page, setPage] = useState(1);
  const filters = { q, tab, profile, twoFactor };
  const query = useAccounts({ ...filters, page, pageSize: PAGE_SIZE });
  const reset = () => {
    setQ('');
    setTab('');
    setProfile('');
    setTwoFactor('');
    setPage(1);
  };
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        title="Comptes et profils"
        subtitle="Une personne a un seul compte et un ou plusieurs profils : bailleur, propriétaire, locataire ou agence. Une connexion vaut pour tous ses profils."
        actions={<ExportAccountsButton filters={filters} />}
      />
      <QueryState query={query} label="La liste des comptes">
        {(data) => (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Comptes" value={formatInteger(data.stats.accounts)}>
                <span className="text-caption text-fg-subtle">{formatInteger(data.stats.profiles)} profils actifs</span>
              </StatCard>
              <StatCard label="Plusieurs profils" value={formatInteger(data.stats.multiProfile)}>
                <span className="text-caption text-fg-subtle">dont {formatInteger(data.stats.withThreeProfiles)} avec 3 profils</span>
              </StatCard>
              <StatCard label="Invitations en attente" value={formatInteger(data.stats.invited)}>
                <span className="text-caption text-fg-subtle">Lien valable 7 jours</span>
              </StatCard>
              <StatCard label="Suspendus" value={formatInteger(data.stats.suspended)}>
                <span className="text-caption text-fg-subtle">Connexion bloquée</span>
              </StatCard>
            </div>
            <Tabs
              value={tab}
              defaultValue=""
              onValueChange={(value) => {
                setTab(value as AccountState | '');
                setPage(1);
              }}
            >
              <TabList aria-label="État du compte">
                <Tab value="" count={data.counts.all}>Tous</Tab>
                <Tab value="actif" count={data.counts.actif}>Actifs</Tab>
                <Tab value="invite" count={data.counts.invite}>Invités</Tab>
                <Tab value="suspendu" count={data.counts.suspendu}>Suspendus</Tab>
              </TabList>
              <TabPanel value={tab} className="flex flex-col gap-4">
            <FilterBar label="Filtrer les comptes">
              <div className="w-full sm:w-64">
                <TextField
                  label="Rechercher un compte"
                  hideLabel
                  type="search"
                  placeholder="Nom, e-mail"
                  value={q}
                  onChange={(event) => {
                    setQ(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <Select
                label="Profil"
                hideLabel
                placeholder="Profil : Tous"
                className="w-full sm:w-44"
                options={PROFILE_OPTIONS}
                value={profile}
                onValueChange={(value) => {
                  setProfile(value as ProfileKind | '');
                  setPage(1);
                }}
              />
              <Select
                label="Double authentification"
                hideLabel
                placeholder="Double auth. : Tous"
                className="w-full sm:w-48"
                options={TWO_FACTOR_OPTIONS}
                value={twoFactor}
                onValueChange={(value) => {
                  setTwoFactor(value as '' | 'avec' | 'sans');
                  setPage(1);
                }}
              />
            </FilterBar>
            {data.rows.length === 0 ? (
              <EmptyState icon={Users} title="Aucun compte ne correspond" description="Modifiez la recherche ou les filtres pour élargir la liste.">
                <Button variant="secondary" onClick={reset}>
                  Effacer les filtres
                </Button>
              </EmptyState>
            ) : (
              <>
                <DataTable
                  label="Comptes"
                  Link={Link}
                  columns={columns}
                  rows={data.rows}
                  rowKey={(row) => row.id}
                  rowLink={(row) => ({ href: `/comptes/${row.id}`, label: `Ouvrir le compte de ${row.name}` })}
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
