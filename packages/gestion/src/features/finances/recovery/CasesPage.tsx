'use client';

import { Badge, Card, EmptyState, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Gavel } from 'lucide-react';
import { useState } from 'react';
import { RecoverySections } from './RecoverySections';
import { useCases } from './hooks';
import { caseBadge } from './labels';
import { CASE_STATUSES } from './model';
import type { CaseStatus, CaseSummary } from './model';
import { recoveryPaths } from './paths';
import { CursorPager, useCursorPages } from '../rent/CursorPager';
import { moneyText } from '../rent/labels';
import { useLeaseChoices } from '../rent/useLeaseChoices';
import { ListLoading, LoadError, PageHeader, useGestionNavigation } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

const ALL = 'tous';

const statusOptions = [{ value: ALL, label: 'Tous les statuts' }, ...CASE_STATUSES.map((status) => ({ value: status, label: caseBadge[status].label }))];

const isStatus = (value: string): value is CaseStatus => CASE_STATUSES.some((status) => status === value);

export function CasesPage() {
  const choices = useLeaseChoices();
  const pages = useCursorPages();
  const [status, setStatus] = useState(ALL);
  const [leaseId, setLeaseId] = useState(ALL);
  const cases = useCases({ cursor: pages.cursor, status: isStatus(status) ? status : undefined, leaseId: leaseId === ALL ? undefined : leaseId });
  const rows = cases.data?.items ?? [];
  const filtered = status !== ALL || leaseId !== ALL;
  const changed = (set: (value: string) => void) => (value: string) => { set(value); pages.reset(); };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Recouvrement' }]}
        title="Recouvrement"
        subtitle="Un dossier par bail et locataire : créances, carnet des diligences et pièces transmises au commissaire de justice."
      />
      <RecoverySections current="cases" />
      <Card role="region" aria-label="Dossiers de recouvrement" className="gap-3">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Statut" hideLabel placeholder="Statut" value={status} onValueChange={changed(setStatus)} options={statusOptions} />
          <Select label="Bail" hideLabel placeholder="Bail" value={leaseId} onValueChange={changed(setLeaseId)} searchable searchPlaceholder="Rechercher un bail" options={[{ value: ALL, label: 'Tous les baux' }, ...choices.options]} />
        </div>
        {cases.isError ? <LoadError title={cases.error?.message ?? 'Les dossiers n’ont pas pu être chargés'} /> : null}
        {cases.isPending && !cases.isError ? <ListLoading label="Chargement des dossiers" /> : null}
        {cases.data && rows.length === 0 ? (
          <EmptyState icon={Gavel} title="Aucun dossier de recouvrement" description={filtered ? 'Aucun dossier ne correspond à ces filtres.' : 'Ouvrez un dossier depuis la liste des impayés en sélectionnant les créances à recouvrer.'} />
        ) : null}
        {rows.length > 0 ? (
          <Table aria-label="Dossiers de recouvrement">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Dossier</TableHeaderCell>
                <TableHeaderCell>Locataire</TableHeaderCell>
                <TableHeaderCell>Bail</TableHeaderCell>
                <TableHeaderCell>Ouvert le</TableHeaderCell>
                <TableHeaderCell numeric>Créances</TableHeaderCell>
                <TableHeaderCell numeric>Reste dû</TableHeaderCell>
                <TableHeaderCell>Statut</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <CaseRow key={row.id} row={row} />
              ))}
            </TableBody>
          </Table>
        ) : null}
        <CursorPager pages={pages} nextCursor={cases.data?.nextCursor ?? null} label="Pagination des dossiers" />
      </Card>
    </>
  );
}

function CaseRow({ row }: { row: CaseSummary }) {
  const { Link } = useGestionNavigation();
  const badge = caseBadge[row.status];
  return (
    <TableRow>
      <TableCell strong>
        <Link href={recoveryPaths.case(row.id)} className="text-action-on-subtle underline-offset-2 hover:underline">{row.number}</Link>
      </TableCell>
      <TableCell>{row.debtorName ?? 'Locataire inconnu'}</TableCell>
      <TableCell>{row.leaseReference ?? '—'}</TableCell>
      <TableCell>{formatDateFr(row.openedOn)}</TableCell>
      <TableCell numeric>{row.itemsCount}</TableCell>
      <TableCell numeric className={row.outstanding.amount > 0 ? 'text-fg-danger' : undefined}>{moneyText(row.outstanding)}</TableCell>
      <TableCell><Badge tone={badge.tone}>{badge.label}</Badge></TableCell>
    </TableRow>
  );
}
