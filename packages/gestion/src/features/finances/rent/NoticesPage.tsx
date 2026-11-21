'use client';

import { Badge, Button, Card, ConfirmDialog, EmptyState, Icon, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { CalendarX, Send } from 'lucide-react';
import { useState } from 'react';
import { CursorPager, useCursorPages } from './CursorPager';
import { useInstallmentActions } from './InstallmentActions';
import { useInstallments, useIssueDueNotices, useRentPermissions } from './hooks';
import { installmentBadge, moneyText, periodLabel } from './labels';
import { isMonth, monthOptions, monthRange } from './noticeMonths';
import type { RentInstallment } from './model';
import { batchMessage } from './outcomes';
import { rentPaths } from './paths';
import { useLeaseChoices } from './useLeaseChoices';
import { ActionMenu, ListLoading, LoadError, PageHeader, errorMessage, useGestionNavigation, useNotify } from '../../locataires/kit';
import type { ActionItem } from '../../locataires/kit';
import { formatDateFr, monthLabel, todayIso } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

const NOTICE_ACTIONS = ['issue', 'notice-pdf'];

function noticeState(row: RentInstallment): { label: string; tone: 'success' | 'warning' | 'neutral' } {
  if (row.notice) return { label: `Avis ${row.notice.number}, émis le ${formatDateFr(row.notice.issuedOn)}`, tone: 'success' };
  if (row.status === 'upcoming') return { label: 'À émettre', tone: 'warning' };
  return { label: installmentBadge[row.status].label, tone: 'neutral' };
}

export function NoticesPage() {
  const permissions = useRentPermissions();
  const { search } = useGestionNavigation();
  const notify = useNotify();
  const pages = useCursorPages();
  const issueDue = useIssueDueNotices();
  const actions = useInstallmentActions();
  const today = todayIso();
  const requested = search.get('mois');
  const [month, setMonth] = useState(isMonth(requested) ? requested : today.slice(0, 7));
  const [confirmingBatch, setConfirmingBatch] = useState(false);

  const installments = useInstallments({ cursor: pages.cursor, ...monthRange(month) });
  const rows = installments.data?.items ?? [];

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
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Baux' }, { label: 'Avis d’échéance' }]}
        title="Avis d’échéance"
        subtitle="Un avis annonce au locataire le montant et la date de son prochain terme. Il ne vaut pas quittance."
        actions={permissions.manage ? <Button variant="secondary" loading={issueDue.isPending} onClick={() => { setConfirmingBatch(true); }}><Icon icon={Send} />Émettre les avis échus</Button> : null}
      />
      <Card role="region" aria-label="Avis du mois" className="gap-3">
        <div className="grid grid-cols-1 gap-2 sm:max-w-xs">
          <Select label="Mois d’échéance" placeholder="Mois" value={month} onValueChange={(value) => { setMonth(value); pages.reset(); }} options={monthOptions(today, month)} />
        </div>
        {installments.isError ? <LoadError title={installments.error?.message ?? 'Les avis d’échéance n’ont pas pu être chargés'} /> : null}
        {installments.isPending && !installments.isError ? <ListLoading label="Chargement des avis d’échéance" /> : null}
        {installments.data && rows.length === 0 ? <EmptyState icon={CalendarX} title="Aucun avis" description={`Aucune échéance n’est appelée pour ${monthLabel(month).toLowerCase()}. Elles apparaissent après la génération de l’échéancier d’un bail signé.`} /> : null}
        {rows.length > 0 ? (
          <Table aria-label="Avis d’échéance">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Bail</TableHeaderCell>
                <TableHeaderCell>Échéance</TableHeaderCell>
                <TableHeaderCell numeric>Montant charges comprises</TableHeaderCell>
                <TableHeaderCell>État de l’avis</TableHeaderCell>
                <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <NoticeRow key={row.id} row={row} actions={actions.actionsFor(row).filter((action) => NOTICE_ACTIONS.includes(action.id))} />
              ))}
            </TableBody>
          </Table>
        ) : null}
        <CursorPager pages={pages} nextCursor={installments.data?.nextCursor ?? null} label="Pagination des avis" />
      </Card>
      {actions.dialogs}
      <ConfirmDialog
        open={confirmingBatch}
        onOpenChange={setConfirmingBatch}
        title="Émettre les avis échus ?"
        description="Un avis est émis, numéroté et inscrit au grand livre pour chaque échéance à venir dont la date d’avis est atteinte (100 au plus à la fois). L’avis est mis à disposition en PDF : le serveur ne l’envoie pas au locataire."
        confirmLabel="Émettre les avis"
        loading={issueDue.isPending}
        onConfirm={() => { void runBatch(); }}
      />
    </>
  );
}

function NoticeRow({ row, actions }: { row: RentInstallment; actions: ActionItem[] }) {
  const { Link } = useGestionNavigation();
  const choices = useLeaseChoices();
  const tenant = choices.tenantOf(row.partyId);
  const state = noticeState(row);
  return (
    <TableRow>
      <TableCell strong>
        <Link href={rentPaths.installment(row.id)} className="text-action-on-subtle underline-offset-2 hover:underline">{row.leaseReference ?? 'Bail'}</Link>
        {tenant ? <span className="block text-caption font-normal text-fg-subtle">{tenant}</span> : null}
      </TableCell>
      <TableCell>
        <span className="flex flex-col">
          <span>{formatDateFr(row.dueDate)}</span>
          <span className="text-caption text-fg-subtle">{periodLabel(row.periodStart, row.periodEnd)}</span>
        </span>
      </TableCell>
      <TableCell numeric>{moneyText(row.total)}</TableCell>
      <TableCell>
        <span className="flex flex-wrap items-center gap-1">
          <Badge tone={state.tone === 'success' ? 'success' : state.tone === 'warning' ? 'warning' : 'neutral'}>{state.label}</Badge>
          {row.isOverdue ? <Badge tone="danger">En retard</Badge> : null}
        </span>
      </TableCell>
      <TableCell>{actions.length > 0 ? <ActionMenu label={`Actions pour l’avis de l’échéance du ${formatDateFr(row.dueDate)}`} items={actions} /> : null}</TableCell>
    </TableRow>
  );
}
