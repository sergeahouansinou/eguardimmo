'use client';

import { Badge, Button, Card, EmptyState, Icon, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Banknote, CalendarPlus, CalendarX } from 'lucide-react';
import { useState } from 'react';
import { CursorPager, useCursorPages } from './CursorPager';
import { GenerateInstallmentsDialog } from './GenerateInstallmentsDialog';
import { useInstallmentActions } from './InstallmentActions';
import { LeaseBalanceCard } from './LeaseBalanceCard';
import { useInstallments, useRentPermissions } from './hooks';
import { installmentBadge, moneyText, periodLabel } from './labels';
import { INSTALLMENT_STATUSES } from './model';
import type { InstallmentStatus, RentInstallment } from './model';
import { rentPaths } from './paths';
import { LeaseGate } from '../../baux/LeaseGate';
import { bauxPaths } from '../../baux/paths';
import type { Lease } from '../../baux/schemas';
import { ActionMenu, LinkButton, ListLoading, LoadError, PageHeader, useGestionNavigation } from '../../locataires/kit';
import type { ActionItem } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

const ALL = 'toutes';
const statusOptions = [{ value: ALL, label: 'Tous les statuts' }, ...INSTALLMENT_STATUSES.map((status) => ({ value: status, label: installmentBadge[status].label }))];
const isStatus = (value: string): value is InstallmentStatus => INSTALLMENT_STATUSES.some((status) => status === value);

export function LeaseSchedulePage({ id }: { id: string }) {
  return <LeaseGate id={id} title="Échéancier">{(lease) => <Schedule lease={lease} />}</LeaseGate>;
}

function Schedule({ lease }: { lease: Lease }) {
  const permissions = useRentPermissions();
  const actions = useInstallmentActions();
  const pages = useCursorPages();
  const [status, setStatus] = useState(ALL);
  const [generating, setGenerating] = useState(false);
  const installments = useInstallments({ cursor: pages.cursor, leaseId: lease.id, status: isStatus(status) ? status : undefined });
  const rows = installments.data?.items ?? [];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Baux', href: bauxPaths.list }, { label: lease.reference, href: bauxPaths.detail(lease.id) }, { label: 'Échéancier' }]}
        title="Échéancier"
        subtitle={`Bail ${lease.reference}`}
        actions={
          <>
            {permissions.manage ? <Button variant="secondary" onClick={() => { setGenerating(true); }}><Icon icon={CalendarPlus} />Générer les échéances</Button> : null}
            {permissions.recordPayment ? <LinkButton href={rentPaths.newPayment(lease.id)} variant="primary" icon={Banknote}>Enregistrer un paiement</LinkButton> : null}
          </>
        }
      />
      <LeaseBalanceCard leaseId={lease.id} />
      <Card role="region" aria-label="Échéances du bail" className="gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Select label="Statut" hideLabel placeholder="Statut" value={status} onValueChange={(value) => { setStatus(value); pages.reset(); }} options={statusOptions} />
        </div>
        {installments.isError ? <LoadError title={installments.error?.message ?? 'Les échéances n’ont pas pu être chargées'} /> : null}
        {installments.isPending && !installments.isError ? <ListLoading label="Chargement des échéances" /> : null}
        {installments.data && rows.length === 0 ? (
          <EmptyState icon={CalendarX} title="Aucune échéance" description={status === ALL ? 'Les échéances apparaissent après la génération de celles d’un bail signé.' : 'Aucune échéance ne correspond à ce statut.'} />
        ) : null}
        {rows.length > 0 ? (
          <Table aria-label="Échéances du bail">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Échéance</TableHeaderCell>
                <TableHeaderCell>Période</TableHeaderCell>
                <TableHeaderCell numeric>Loyer</TableHeaderCell>
                <TableHeaderCell numeric>Charges</TableHeaderCell>
                <TableHeaderCell numeric>Total</TableHeaderCell>
                <TableHeaderCell numeric>Reste dû</TableHeaderCell>
                <TableHeaderCell>Statut</TableHeaderCell>
                <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <ScheduleRow key={row.id} row={row} actions={actions.actionsFor(row)} />
              ))}
            </TableBody>
          </Table>
        ) : null}
        <CursorPager pages={pages} nextCursor={installments.data?.nextCursor ?? null} label="Pagination des échéances du bail" />
      </Card>
      {actions.dialogs}
      <GenerateInstallmentsDialog open={generating} onClose={() => { setGenerating(false); }} leaseId={lease.id} />
    </>
  );
}

function ScheduleRow({ row, actions }: { row: RentInstallment; actions: ActionItem[] }) {
  const { Link } = useGestionNavigation();
  const badge = installmentBadge[row.status];
  return (
    <TableRow>
      <TableCell strong>
        <Link href={rentPaths.installment(row.id)} className="text-action-on-subtle underline-offset-2 hover:underline">{formatDateFr(row.dueDate)}</Link>
      </TableCell>
      <TableCell>{periodLabel(row.periodStart, row.periodEnd)}</TableCell>
      <TableCell numeric>{moneyText(row.rent)}</TableCell>
      <TableCell numeric>{moneyText(row.charges)}</TableCell>
      <TableCell numeric>{moneyText(row.total)}</TableCell>
      <TableCell numeric className={row.outstanding && row.outstanding.amount > 0 ? 'text-fg-danger' : undefined}>{row.outstanding ? moneyText(row.outstanding) : '—'}</TableCell>
      <TableCell>
        <span className="flex flex-wrap items-center gap-1">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          {row.isOverdue ? <Badge tone="danger">En retard</Badge> : null}
        </span>
      </TableCell>
      <TableCell>{actions.length > 0 ? <ActionMenu label={`Actions pour l’échéance du ${formatDateFr(row.dueDate)}`} items={actions} /> : null}</TableCell>
    </TableRow>
  );
}
