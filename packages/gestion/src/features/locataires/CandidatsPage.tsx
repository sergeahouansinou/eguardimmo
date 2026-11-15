'use client';

import { Users } from 'lucide-react';
import { Badge, Card, EmptyState, Pagination, Select, Tab, TabList, TabPanel, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, Tabs } from '@eguardimmo/ui';
import { useState } from 'react';
import { candidateStatusBadge, useCandidateActions } from './useCandidateActions';
import { useCandidates, useUnits } from './hooks';
import { ActionMenu, LinkButton, ListLoading, LoadError, PageHeader, SearchInput } from './kit';
import { formatDateFr } from './kit/dates';
import { money } from './kit/money';
import { useListView } from './kit/useListView';
import type { ListTab } from './kit/useListView';
import { locatairesPaths } from './paths';
import { unitFullLabel } from './schemas';
import type { Candidate } from './schemas';

const ALL = 'tous';

const tabs: ListTab<Candidate>[] = [
  { id: 'tous', label: 'Tous', match: () => true },
  { id: 'en_attente', label: 'En attente', match: (candidate) => candidate.status === 'en_attente' },
  { id: 'preselection', label: 'Présélection', match: (candidate) => candidate.status === 'preselection' },
  { id: 'confirme', label: 'Confirmés', match: (candidate) => candidate.status === 'confirme' },
  { id: 'refuse', label: 'Refusés', match: (candidate) => candidate.status === 'refuse' },
];

export function CandidatsPage() {
  const candidates = useCandidates();
  const units = useUnits();
  const { actionsFor, dialogs } = useCandidateActions();
  const [unitId, setUnitId] = useState(ALL);
  const unitList = units.data ?? [];
  const unitLabel = (id: string) => {
    const unit = unitList.find((entry) => entry.id === id);
    return unit ? unitFullLabel(unit) : id;
  };

  const view = useListView({
    items: candidates.data ?? [],
    tabs,
    searchText: (candidate) => `${candidate.firstName} ${candidate.lastName} ${unitLabel(candidate.unitId)}`,
    predicate: (candidate) => unitId === ALL || candidate.unitId === unitId,
  });

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Locataires', href: locatairesPaths.list }, { label: 'Candidats' }]}
        title="Candidats"
        subtitle="Personnes intéressées par un bien, avant la création du bail."
        actions={<LinkButton href={locatairesPaths.inviteCandidate} variant="primary">Inviter un candidat</LinkButton>}
      />
      {candidates.isError ? <LoadError title="Les candidats n’ont pas pu être chargés" /> : null}
      <Card role="region" aria-label="Liste des candidats" className="gap-3">
        <Tabs value={view.tab} onValueChange={view.setTab} defaultValue="tous">
          <TabList aria-label="Filtrer les candidats">
            {tabs.map((tab) => (
              <Tab key={tab.id} value={tab.id} count={view.counts[tab.id] ?? 0}>{tab.label}</Tab>
            ))}
          </TabList>
          <TabPanel value={view.tab} className="flex flex-col gap-3 pt-1">
            <div className="flex flex-wrap items-end gap-2">
              <SearchInput label="Rechercher un candidat" placeholder="Nom, bien" value={view.query} onValueChange={view.setQuery} />
              <Select
                label="Bien"
                hideLabel
                placeholder="Bien : Tous"
                value={unitId}
                onValueChange={(value) => { setUnitId(value); view.resetPage(); }}
                options={[{ value: ALL, label: 'Bien : Tous' }, ...unitList.map((unit) => ({ value: unit.id, label: unitFullLabel(unit) }))]}
                className="w-56"
              />
            </div>
            {candidates.isPending ? <ListLoading label="Chargement des candidats" /> : null}
            {candidates.data && view.rows.length === 0 ? (
              <EmptyState icon={Users} title="Aucun candidat" description="Aucun candidat ne correspond à ces critères." />
            ) : null}
            {view.rows.length > 0 ? (
              <Table aria-label="Candidats">
                <TableHead>
                  <tr>
                    <TableHeaderCell>Candidat</TableHeaderCell>
                    <TableHeaderCell>Bien</TableHeaderCell>
                    <TableHeaderCell>Téléphone</TableHeaderCell>
                    <TableHeaderCell>E-mail</TableHeaderCell>
                    <TableHeaderCell numeric>Revenus mensuels</TableHeaderCell>
                    <TableHeaderCell>Reçu le</TableHeaderCell>
                    <TableHeaderCell>État</TableHeaderCell>
                    <TableHeaderCell><span className="sr-only">Action</span></TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {view.rows.map((candidate) => {
                    const badge = candidateStatusBadge[candidate.status];
                    const name = `${candidate.firstName} ${candidate.lastName}`;
                    return (
                      <TableRow key={candidate.id}>
                        <TableCell strong>{name}</TableCell>
                        <TableCell>{unitLabel(candidate.unitId)}</TableCell>
                        <TableCell>{candidate.phone || '—'}</TableCell>
                        <TableCell>{candidate.email}</TableCell>
                        <TableCell numeric>{candidate.monthlyIncome > 0 ? money(candidate.monthlyIncome) : '—'}</TableCell>
                        <TableCell>{formatDateFr(candidate.receivedOn)}</TableCell>
                        <TableCell><Badge tone={badge.tone}>{badge.label}</Badge></TableCell>
                        <TableCell>
                          <span className="flex items-center justify-end gap-1.5">
                            <LinkButton href={locatairesPaths.candidate(candidate.id)} variant="ghost" size="sm">Ouvrir</LinkButton>
                            <ActionMenu label={`Plus d’actions, ${name}`} items={actionsFor(candidate)} />
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : null}
            <Pagination page={view.page} pageSize={view.pageSize} total={view.total} onPageChange={view.setPage} label="Pagination des candidats" />
          </TabPanel>
        </Tabs>
      </Card>
      {dialogs}
    </>
  );
}
