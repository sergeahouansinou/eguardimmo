'use client';

import { Badge, Card, Checkbox, EmptyState, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { ClipboardList, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { useDebounced } from '../finances/invoicing/useDebounced';
import { CursorPager, useCursorPages } from '../finances/rent/CursorPager';
import { LinkButton, ListLoading, LoadError, PageHeader, SearchInput, useGestionNavigation } from '../locataires/kit';
import { formatDateFr } from '../locataires/kit/dates';
import { links } from '../locataires/kit/links';
import { useInterventions, useMaintenancePermissions } from './hooks';
import { MaintenanceGate } from './MaintenanceGate';
import { ORIGINS, PRIORITIES, INTERVENTION_STATUSES } from './model';
import type { Intervention, InterventionStatus, Origin, Priority } from './model';
import { originLabel, priorityBadge, statusBadge } from './labels';
import { maintenancePaths } from './paths';

const ALL = 'toutes';
const statusOptions = [{ value: ALL, label: 'Tous les statuts' }, ...INTERVENTION_STATUSES.map((status) => ({ value: status, label: statusBadge[status].label }))];
const priorityOptions = [{ value: ALL, label: 'Toutes les priorités' }, ...PRIORITIES.map((priority) => ({ value: priority, label: priorityBadge[priority].label }))];
const originOptions = [{ value: ALL, label: 'Toutes les origines' }, ...ORIGINS.map((origin) => ({ value: origin, label: originLabel[origin] }))];
const isStatus = (value: string): value is InterventionStatus => INTERVENTION_STATUSES.some((status) => status === value);
const isPriority = (value: string): value is Priority => PRIORITIES.some((priority) => priority === value);
const isOrigin = (value: string): value is Origin => ORIGINS.some((origin) => origin === value);

export function InterventionsPage() {
  return (
    <MaintenanceGate>
      <InterventionsList />
    </MaintenanceGate>
  );
}

function InterventionsList() {
  const permissions = useMaintenancePermissions();
  const pages = useCursorPages();
  const [status, setStatus] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [origin, setOrigin] = useState(ALL);
  const [overdue, setOverdue] = useState(false);
  const [text, setText] = useState('');
  const searched = useDebounced(text.trim(), 300);
  const query = {
    cursor: pages.cursor,
    status: isStatus(status) ? status : undefined,
    priority: isPriority(priority) ? priority : undefined,
    origin: isOrigin(origin) ? origin : undefined,
    overdue: overdue ? true : undefined,
    search: searched === '' ? undefined : searched,
  };
  const interventions = useInterventions(query);
  const rows = interventions.data?.items ?? [];
  const filtered = status !== ALL || priority !== ALL || origin !== ALL || overdue || searched !== '';
  const changed = <T,>(set: (value: T) => void) => (value: T) => { set(value); pages.reset(); };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Interventions' }]}
        title="Interventions"
        subtitle="Signalements des locataires et demandes de l’équipe, du devis à la facture du prestataire."
        actions={
          <>
            <LinkButton href={maintenancePaths.suppliers} icon={Users}>Prestataires</LinkButton>
            {permissions.write ? <LinkButton href={maintenancePaths.newIntervention} variant="primary" icon={Plus}>Nouvelle intervention</LinkButton> : null}
          </>
        }
      />
      <Card role="region" aria-label="Interventions" className="gap-3">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Select label="Statut" hideLabel placeholder="Statut" value={status} onValueChange={changed(setStatus)} options={statusOptions} />
          <Select label="Priorité" hideLabel placeholder="Priorité" value={priority} onValueChange={changed(setPriority)} options={priorityOptions} />
          <Select label="Origine" hideLabel placeholder="Origine" value={origin} onValueChange={changed(setOrigin)} options={originOptions} />
          <SearchInput label="Rechercher une intervention" placeholder="Titre ou référence" value={text} onValueChange={changed(setText)} />
          <Checkbox label="En retard seulement" checked={overdue} onChange={(event) => { changed(setOverdue)(event.target.checked); }} />
        </div>
        {interventions.isError ? <LoadError title={interventions.error?.message ?? 'Les interventions n’ont pas pu être chargées'} /> : null}
        {interventions.isPending && !interventions.isError ? <ListLoading label="Chargement des interventions" /> : null}
        {interventions.data && rows.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Aucune intervention" description={filtered ? 'Aucune intervention ne correspond à ces filtres.' : 'Les signalements des locataires et vos demandes apparaissent ici.'}>
            {permissions.write && !filtered ? <LinkButton href={maintenancePaths.newIntervention} variant="primary" icon={Plus}>Créer une intervention</LinkButton> : null}
          </EmptyState>
        ) : null}
        {rows.length > 0 ? (
          <Table aria-label="Interventions">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Référence</TableHeaderCell>
                <TableHeaderCell>Intervention</TableHeaderCell>
                <TableHeaderCell>Lot</TableHeaderCell>
                <TableHeaderCell>Prestataire</TableHeaderCell>
                <TableHeaderCell>Échéance</TableHeaderCell>
                <TableHeaderCell>Priorité</TableHeaderCell>
                <TableHeaderCell>Statut</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => <InterventionRow key={row.id} row={row} />)}
            </TableBody>
          </Table>
        ) : null}
        <CursorPager pages={pages} nextCursor={interventions.data?.nextCursor ?? null} label="Pagination des interventions" />
      </Card>
    </>
  );
}

function InterventionRow({ row }: { row: Intervention }) {
  const { Link } = useGestionNavigation();
  return (
    <TableRow>
      <TableCell>{row.reference}</TableCell>
      <TableCell strong>
        <Link href={maintenancePaths.intervention(row.id)} className="text-action-on-subtle underline-offset-2 hover:underline">{row.title}</Link>
      </TableCell>
      <TableCell>{row.unit?.reference ?? '—'}</TableCell>
      <TableCell>{row.supplier?.name ?? '—'}</TableCell>
      <TableCell>{formatDateFr(row.dueOn)}</TableCell>
      <TableCell><Badge tone={priorityBadge[row.priority].tone}>{priorityBadge[row.priority].label}</Badge></TableCell>
      <TableCell><Badge tone={statusBadge[row.status].tone}>{statusBadge[row.status].label}</Badge></TableCell>
    </TableRow>
  );
}
