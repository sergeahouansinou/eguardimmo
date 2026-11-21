'use client';

import { Badge, Card, EmptyState, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Banknote, Ban } from 'lucide-react';
import { useState } from 'react';
import { CursorPager, useCursorPages } from './CursorPager';
import { ReasonDialog } from './ReasonDialog';
import { RentSections } from './RentSections';
import { useCancelPayment, usePayments, useRentPermissions } from './hooks';
import { methodLabel, moneyText, paymentBadge } from './labels';
import { PAYMENT_STATUSES } from './model';
import type { PaymentStatus, RentPayment } from './model';
import { rentPaths } from './paths';
import { useLeaseChoices } from './useLeaseChoices';
import { ActionMenu, LinkButton, ListLoading, LoadError, PageHeader, errorMessage, useGestionNavigation, useNotify } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

const ALL = 'tous';
const statusOptions = [{ value: ALL, label: 'Tous les statuts' }, ...PAYMENT_STATUSES.map((status) => ({ value: status, label: paymentBadge[status].label }))];
const isStatus = (value: string): value is PaymentStatus => PAYMENT_STATUSES.some((status) => status === value);

export function PaymentsPage() {
  const { search } = useGestionNavigation();
  const permissions = useRentPermissions();
  const choices = useLeaseChoices();
  const notify = useNotify();
  const cancel = useCancelPayment();
  const pages = useCursorPages();
  const [status, setStatus] = useState(ALL);
  const [leaseId, setLeaseId] = useState(search.get('bail') ?? ALL);
  const [target, setTarget] = useState<RentPayment | null>(null);

  const payments = usePayments({ cursor: pages.cursor, leaseId: leaseId === ALL ? undefined : leaseId, status: isStatus(status) ? status : undefined });
  const rows = payments.data?.items ?? [];
  const filtered = status !== ALL || leaseId !== ALL;

  const confirmCancel = async (payment: RentPayment, reason: string) => {
    try {
      await cancel.mutateAsync({ id: payment.id, reason });
      notify({ title: 'Paiement annulé', description: `Le paiement de ${moneyText(payment.amount)} est annulé, les imputations sont closes.` });
    } catch (error) {
      notify({ tone: 'danger', title: 'Annulation impossible', description: errorMessage(error) });
    }
    setTarget(null);
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Loyers', href: rentPaths.installments }, { label: 'Paiements' }]}
        title="Paiements"
        subtitle="Encaissements saisis, imputés du plus ancien au plus récent sur les échéances appelées."
        actions={permissions.recordPayment ? <LinkButton href={rentPaths.newPayment(leaseId === ALL ? undefined : leaseId)} variant="primary" icon={Banknote}>Enregistrer un paiement</LinkButton> : null}
      />
      <RentSections current="payments" />
      <Card role="region" aria-label="Paiements" className="gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Select label="Statut" hideLabel placeholder="Statut" value={status} onValueChange={(value) => { setStatus(value); pages.reset(); }} options={statusOptions} />
          <Select label="Bail" hideLabel placeholder="Bail" value={leaseId} onValueChange={(value) => { setLeaseId(value); pages.reset(); }} searchable searchPlaceholder="Rechercher un bail" options={[{ value: ALL, label: 'Tous les baux' }, ...choices.options]} />
        </div>
        {payments.isError ? <LoadError title={payments.error?.message ?? 'Les paiements n’ont pas pu être chargés'} /> : null}
        {payments.isPending && !payments.isError ? <ListLoading label="Chargement des paiements" /> : null}
        {payments.data && rows.length === 0 ? <EmptyState icon={Banknote} title="Aucun paiement" description={filtered ? 'Aucun paiement ne correspond à ces filtres.' : 'Les paiements enregistrés apparaîtront ici.'} /> : null}
        {rows.length > 0 ? (
          <Table aria-label="Paiements de loyer">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Reçu le</TableHeaderCell>
                <TableHeaderCell>Bail</TableHeaderCell>
                <TableHeaderCell>Mode</TableHeaderCell>
                <TableHeaderCell numeric>Montant</TableHeaderCell>
                <TableHeaderCell>Imputation</TableHeaderCell>
                <TableHeaderCell>Référence</TableHeaderCell>
                <TableHeaderCell>Statut</TableHeaderCell>
                <TableHeaderCell><span className="sr-only">Actions</span></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((payment) => (
                <PaymentRow key={payment.id} payment={payment} leaseReference={choices.referenceOf(payment.leaseId)} canCancel={permissions.manage && payment.status === 'recorded'} onCancel={() => { setTarget(payment); }} />
              ))}
            </TableBody>
          </Table>
        ) : null}
        <CursorPager pages={pages} nextCursor={payments.data?.nextCursor ?? null} label="Pagination des paiements" />
      </Card>
      <ReasonDialog
        open={target !== null}
        title="Annuler ce paiement ?"
        description={target ? `Le paiement de ${moneyText(target.amount)} reçu le ${formatDateFr(target.receivedOn)} sera contrepassé au grand livre et ses imputations closes. Une quittance devenue fausse sera déclarée nulle.` : ''}
        confirmLabel="Annuler le paiement"
        placeholder="Ex. Chèque rejeté par la banque"
        loading={cancel.isPending}
        onConfirm={(reason) => { if (target) void confirmCancel(target, reason); }}
        onClose={() => { setTarget(null); }}
      />
    </>
  );
}

function PaymentRow({ payment, leaseReference, canCancel, onCancel }: { payment: RentPayment; leaseReference: string | null; canCancel: boolean; onCancel: () => void }) {
  const { Link } = useGestionNavigation();
  const badge = paymentBadge[payment.status];
  const allocated = payment.allocations ?? [];
  return (
    <TableRow>
      <TableCell strong>{formatDateFr(payment.receivedOn)}</TableCell>
      <TableCell>{leaseReference ?? '—'}</TableCell>
      <TableCell>{methodLabel[payment.method]}</TableCell>
      <TableCell numeric>{moneyText(payment.amount)}</TableCell>
      <TableCell>
        {payment.status === 'cancelled' ? (
          <span className="text-fg-subtle">{payment.cancellationReason ? `Annulé : ${payment.cancellationReason}` : 'Annulé'}</span>
        ) : (
          <span className="flex flex-col text-caption">
            {allocated.map((allocation) => (
              <Link key={allocation.installmentId} href={rentPaths.installment(allocation.installmentId)} className="text-action-on-subtle underline-offset-2 hover:underline">{`${moneyText(allocation.amount)} imputés`}</Link>
            ))}
            {payment.advance && payment.advance.amount > 0 ? <span>{`${moneyText(payment.advance)} en avance`}</span> : null}
          </span>
        )}
      </TableCell>
      <TableCell>{payment.reference ?? '—'}</TableCell>
      <TableCell><Badge tone={badge.tone}>{badge.label}</Badge></TableCell>
      <TableCell>{canCancel ? <ActionMenu label={`Actions pour le paiement du ${formatDateFr(payment.receivedOn)}`} items={[{ id: 'cancel', label: 'Annuler le paiement', icon: Ban, tone: 'danger', onSelect: onCancel }]} /> : null}</TableCell>
    </TableRow>
  );
}
