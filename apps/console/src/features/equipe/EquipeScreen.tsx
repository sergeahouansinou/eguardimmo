'use client';

import { Badge, Button, EmptyState, Select, Tab, TabList, TabPanel, Tabs, TextField } from '@eguardimmo/ui';
import { UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useEquipe } from '@/console/hooks/queries';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/console/schemas';
import type { Operator, OperatorRole, OperatorState } from '@/console/schemas';
import { formatDate, formatDateTime } from '@/lib/format';
import { DataTable } from '@/ui/DataTable';
import type { Column } from '@/ui/DataTable';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { QueryState } from '@/ui/QueryState';
import { Section } from '@/ui/Section';
import { ActiveDialog, RoleDialog } from './EquipeDialogs';

const ROLES = Object.keys(ROLE_LABELS) as OperatorRole[];
const ROLE_OPTIONS = [
  { value: '', label: 'Rôle : Tous' },
  ...ROLES.map((value) => ({ value, label: ROLE_LABELS[value] })),
];

function StateBadge({ state }: { state: OperatorState }) {
  if (state === 'invitation') return <Badge tone="info">Invitation envoyée</Badge>;
  if (state === 'desactive') return <Badge tone="neutral">Désactivé</Badge>;
  return <Badge tone="success">Actif</Badge>;
}

type Pending = { kind: 'role' | 'active'; operator: Operator } | null;

export function EquipeScreen() {
  const query = useEquipe();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<OperatorState | ''>('');
  const [role, setRole] = useState<OperatorRole | ''>('');
  const [pending, setPending] = useState<Pending>(null);

  const columns = useMemo<Column<Operator>[]>(
    () => [
      {
        id: 'operator',
        header: 'Opérateur',
        primary: true,
        cell: (row) => (
          <span className="flex min-w-0 flex-col">
            <span className="font-medium">
              {row.name}
              {row.self ? <span className="text-caption font-normal text-fg-subtle"> (vous)</span> : null}
            </span>
            <span className="text-caption font-normal break-all text-fg-subtle">{row.email}</span>
          </span>
        ),
      },
      { id: 'role', header: 'Rôle', cell: (row) => <Badge tone="neutral">{ROLE_LABELS[row.role]}</Badge> },
      {
        id: 'twofactor',
        header: 'Double auth.',
        cell: (row) => <Badge tone={row.twoFactor ? 'success' : 'neutral'}>{row.twoFactor ? '2FA' : 'À configurer'}</Badge>,
      },
      {
        id: 'login',
        header: 'Dernière connexion',
        cell: (row) =>
          row.lastLoginAt ? formatDateTime(row.lastLoginAt) : row.invitedOn ? `Invité le ${formatDate(row.invitedOn)}` : 'Jamais',
      },
      { id: 'state', header: 'État', cell: (row) => <StateBadge state={row.state} /> },
      {
        id: 'actions',
        header: 'Actions',
        cell: (row) =>
          row.self ? (
            <span className="text-caption text-fg-subtle">Votre compte</span>
          ) : (
            <span className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => { setPending({ kind: 'role', operator: row }); }}>
                Changer le rôle
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => { setPending({ kind: 'active', operator: row }); }}
              >
                {row.state === 'desactive' ? 'Réactiver' : 'Désactiver'}
              </Button>
            </span>
          ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        Link={Link}
        title="Équipe opérateur"
        subtitle="Les personnes qui accèdent à la console. La double authentification est obligatoire pour tous."
        actions={
          <Button asChild>
            <Link href="/equipe/inviter">
              <UserPlus aria-hidden="true" className="size-4" />
              Inviter un opérateur
            </Link>
          </Button>
        }
      />
      <QueryState query={query} label="L’équipe opérateur">
        {(data) => {
          const needle = q.trim().toLowerCase();
          const rows = data.operators.filter(
            (operator) =>
              (tab === '' || operator.state === tab) &&
              (role === '' || operator.role === role) &&
              (needle === '' || operator.name.toLowerCase().includes(needle) || operator.email.toLowerCase().includes(needle)),
          );
          return (
            <>
              <Tabs value={tab} defaultValue="" onValueChange={(value) => { setTab(value as OperatorState | ''); }}>
                <TabList aria-label="État de l’opérateur">
                  <Tab value="" count={data.counts.all}>Tous</Tab>
                  <Tab value="actif" count={data.counts.actif}>Actifs</Tab>
                  <Tab value="invitation" count={data.counts.invitation}>Invitations</Tab>
                </TabList>
                <TabPanel value={tab} className="flex flex-col gap-4">
              <FilterBar label="Filtrer l’équipe">
                <div className="w-full sm:w-64">
                  <TextField
                    label="Rechercher un opérateur"
                    hideLabel
                    type="search"
                    placeholder="Nom, e-mail"
                    value={q}
                    onChange={(event) => { setQ(event.target.value); }}
                  />
                </div>
                <Select
                  label="Rôle"
                  hideLabel
                  placeholder="Rôle : Tous"
                  className="w-full sm:w-48"
                  options={ROLE_OPTIONS}
                  value={role}
                  onValueChange={(value) => { setRole(value as OperatorRole | ''); }}
                />
              </FilterBar>
              {rows.length === 0 ? (
                <EmptyState icon={Users} title="Aucun opérateur ne correspond" description="Modifiez la recherche ou les filtres pour élargir la liste.">
                  <Button variant="secondary" onClick={() => { setQ(''); setTab(''); setRole(''); }}>
                    Effacer les filtres
                  </Button>
                </EmptyState>
              ) : (
                <DataTable label="Opérateurs" Link={Link} columns={columns} rows={rows} rowKey={(row) => row.id} />
              )}
                </TabPanel>
              </Tabs>
              <Section id="roles" title="Rôles">
                <ul className="grid grid-cols-1 gap-x-6 gap-y-2 pt-1 sm:grid-cols-2">
                  {ROLES.map((value) => (
                    <li key={value} className="flex flex-col">
                      <span className="text-body-strong">{ROLE_LABELS[value]}</span>
                      <span className="text-caption text-fg-subtle">{ROLE_DESCRIPTIONS[value]}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            </>
          );
        }}
      </QueryState>
      <RoleDialog
        operator={pending?.kind === 'role' ? pending.operator : null}
        onClose={() => { setPending(null); }}
      />
      <ActiveDialog
        operator={pending?.kind === 'active' ? pending.operator : null}
        onClose={() => { setPending(null); }}
      />
    </div>
  );
}
