'use client';

import { Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, Icon, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, TextField } from '@eguardimmo/ui';
import { Banknote, CalendarX, CalendarPlus, Send } from 'lucide-react';
import { useState } from 'react';
import { CursorPager, useCursorPages } from './CursorPager';
import { GenerateInstallmentsDialog } from './GenerateInstallmentsDialog';
import { useInstallmentActions } from './InstallmentActions';
import { RentSections } from './RentSections';
import { useInstallments, useIssueDueNotices, useRentPermissions } from './hooks';
import { installmentBadge, moneyText, periodLabel } from './labels';
import { INSTALLMENT_STATUSES } from './model';
import type { InstallmentStatus, RentInstallment } from './model';
import { batchMessage } from './outcomes';
import { rentPaths } from './paths';
import { useLeaseChoices } from './useLeaseChoices';
import { ActionMenu, LinkButton, ListLoading, LoadError, PageHeader, errorMessage, useGestionNavigation, useNotify } from '../../locataires/kit';
import type { ActionItem } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

const ALL = 'toutes';

const statusOptions = [{ value: ALL, label: 'Tous les statuts' }, ...INSTALLMENT_STATUSES.map((status) => ({ value: status, label: installmentBadge[status].label }))];

const isStatus = (value: string): value is InstallmentStatus => INSTALLMENT_STATUSES.some((status) => status === value);

export function InstallmentsPage() {
  const permissions = useRentPermissions();
  const choices = useLeaseChoices();
  const notify = useNotify();
  const pages = useCursorPages();
  const issueDue = useIssueDueNotices();
  const actions = useInstallmentActions();
  const [status, setStatus] = useState(ALL);
  const [leaseId, setLeaseId] = useState(ALL);
  const [overdue, setOverdue] = useState(false);
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [generating, setGenerating] = useState(false);
  const [confirmingBatch, setConfirmingBatch] = useState(false);

  const query = {
    cursor: pages.cursor,
    leaseId: leaseId === ALL ? undefined : leaseId,
    status: isStatus(status) ? status : undefined,
    overdue: overdue ? true : undefined,
    dueFrom: dueFrom === '' ? undefined : dueFrom,
    dueTo: dueTo === '' ? undefined : dueTo,
  };
  const installments = useInstallments(query);
  const rows = installments.data?.items ?? [];
  const filtered = status !== ALL || leaseId !== ALL || overdue || dueFrom !== '' || dueTo !== '';

  const changed = <T,>(set: (value: T) => void) => (value: T) => { set(value); pages.reset(); };

  const runBatch = async () => {
    setConfirmingBatch(false);
    try {
      notify({ title: 'Avis échus traités', description: batchMessage(await issueDue.mutateAsync(), { none: 'Aucun avis à émettre.', one: 'avis émis', many: 'avis émis' }) });
    } catch (error) {
      notify({ tone: 'danger', title: 'Émission impossible', description: errorMessage(error) });
    }
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Loyers' }]}
        title="Loyers"
        subtitle="Échéances appelées, avis d’échéance et reste dû lu au grand livre."
        actions={
          <>
            {permissions.manage ? <Button variant="secondary" onClick={() => { setGenerating(true); }}><Icon icon={CalendarPlus} />Générer les échéances</Button> : null}
            {permissions.manage ? <Button variant="secondary" loading={issueDue.isPending} onClick={() => { setConfirmingBatch(true); }}><Icon icon={Send} />Émettre les avis échus</Button> : null}
            {permissions.recordPayment ? <LinkButton href={rentPaths.newPayment()} variant="primary" icon={Banknote}>Enregistrer un paiement</LinkButton> : null}
          </>
        }
      />
      <RentSections current="installments" />
      <Card role="region" aria-label="Échéances" className="gap-3">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Select label="Statut" hideLabel placeholder="Statut" value={status} onValueChange={changed(setStatus)} options={statusOptions} />
          <Select label="Bail" hideLabel placeholder="Bail" value={leaseId} onValueChange={changed(setLeaseId)} searchable searchPlaceholder="Rechercher un bail" options={[{ value: ALL, label: 'Tous les baux' }, ...choices.options]} />
          <TextField label="Échéance à partir du" type="date" placeholder="AAAA-MM-JJ" value={dueFrom} onChange={(event) => { changed(setDueFrom)(event.target.value); }} />
          <TextField label="Échéance jusqu’au" type="date" placeholder="AAAA-MM-JJ" value={dueTo} min={dueFrom === '' ? undefined : dueFrom} onChange={(event) => { changed(setDueTo)(event.target.value); }} />
          <Checkbox label="En retard seulement" checked={overdue} onChange={(event) => { changed(setOverdue)(event.target.checked); }} />
        </div>
        {installments.isError ? <LoadError title={installments.error?.message ?? 'Les échéances n’ont pas pu être chargées'} /> : null}
        {installments.isPending && !installments.isError ? <ListLoading label="Chargement des échéances" /> : null}
        {installments.data && rows.length === 0 ? (
          <EmptyState icon={CalendarX} title="Aucune échéance" description={filtered ? 'Aucune échéance ne correspond à ces filtres.' : 'Les échéances apparaissent après la génération de celles d’un bail signé.'} />
        ) : null}
        {rows.length > 0 ? (
          <Table aria-label="Échéances de loyer">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Échéance</TableHeaderCell>
                <TableHeaderCell>Période</TableHeaderCell>
                <TableHeaderCell>Bail</TableHeaderCell>
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
                <InstallmentRow key={row.id} row={row} actions={actions.actionsFor(row)} />
              ))}
            </TableBody>
          </Table>
        ) : null}
        <CursorPager pages={pages} nextCursor={installments.data?.nextCursor ?? null} label="Pagination des échéances" />
      </Card>
      {actions.dialogs}
      <GenerateInstallmentsDialog open={generating} onClose={() => { setGenerating(false); }} />
      <ConfirmDialog
        open={confirmingBatch}
        onOpenChange={setConfirmingBatch}
        title="Émettre les avis échus ?"
        description="Un avis est émis, numéroté et inscrit au grand livre pour chaque échéance à venir dont la date d’avis est atteinte (100 au plus à la fois)."
        confirmLabel="Émettre les avis"
        loading={issueDue.isPending}
        onConfirm={() => { void runBatch(); }}
      />
    </>
  );
}

function InstallmentRow({ row, actions }: { row: RentInstallment; actions: ActionItem[] }) {
  const { Link } = useGestionNavigation();
  const choices = useLeaseChoices();
  const badge = installmentBadge[row.status];
  const tenant = choices.tenantOf(row.partyId);
  return (
    <TableRow>
      <TableCell strong>
        <Link href={rentPaths.installment(row.id)} className="text-action-on-subtle underline-offset-2 hover:underline">{formatDateFr(row.dueDate)}</Link>
      </TableCell>
      <TableCell>{periodLabel(row.periodStart, row.periodEnd)}</TableCell>
      <TableCell>
        <span className="flex flex-col">
          <span>{row.leaseReference ?? '—'}</span>
          {tenant ? <span className="text-caption text-fg-subtle">{tenant}</span> : null}
        </span>
      </TableCell>
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
