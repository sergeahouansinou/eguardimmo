'use client';

import { Badge, Card, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { useState } from 'react';
import { formatMoney } from '../../../format/money';
import { CursorPager, useCursorPages } from '../../finances/rent/CursorPager';
import { ListLoading, LoadError, NoRows, PageHeader, useGestionNavigation } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';
import { RoleGate, canReadPayments, useTenantRequestsPermissions } from '../shared/access';
import { useLeaseLabels } from '../shared/hooks';
import { tenantRequestsPaths } from '../shared/paths';
import { PaymentAccountCard } from './PaymentAccountCard';
import { useOnlinePayments } from './hooks';
import { PAYMENT_STATUSES, methodLabel, paymentStatusBadge } from './model';
import type { PaymentQuery } from './model';

const ALL = '';
const CRUMBS = [{ label: 'Finances' }, { label: 'Paiements en ligne' }];

export function OnlinePaymentsPage() {
  return (
    <RoleGate allowed={canReadPayments} title="Paiements en ligne" crumbs={CRUMBS} message="Les paiements en ligne sont réservés au propriétaire, à l’administrateur, au gestionnaire et au comptable de l’organisation.">
      <OnlinePaymentsContent />
    </RoleGate>
  );
}

function OnlinePaymentsContent() {
  const permissions = useTenantRequestsPermissions();
  const { search, Link } = useGestionNavigation();
  const leaseId = search.get('bail');
  const pages = useCursorPages();
  const [status, setStatus] = useState(ALL);
  const query: PaymentQuery = { cursor: pages.cursor, status: PAYMENT_STATUSES.find((value) => value === status) ?? null, leaseId };
  const labels = useLeaseLabels(leaseId === null ? [] : [leaseId]);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, ...CRUMBS]}
        title="Paiements en ligne"
        subtitle="Les paiements que vos locataires lancent depuis leur espace. L’encaissement n’est enregistré qu’une fois confirmé par le prestataire de paiement."
      />
      {permissions.manageAccount ? <PaymentAccountCard /> : null}
      <Card role="region" aria-label="Liste des paiements en ligne" className="gap-3">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Statut"
            placeholder="Tous les statuts"
            options={[{ value: ALL, label: 'Tous les statuts' }, ...PAYMENT_STATUSES.map((value) => ({ value, label: paymentStatusBadge[value].label }))]}
            value={status}
            onValueChange={(value) => { setStatus(value); pages.reset(); }}
          />
        </div>
        {leaseId === null ? null : (
          <p className="text-body text-fg-muted">
            {`Bail ${labels.referenceOf(leaseId)} uniquement. `}
            <Link href={tenantRequestsPaths.onlinePayments} className="text-action-on-subtle underline underline-offset-2">Voir tous les paiements</Link>
          </p>
        )}
        <PaymentsTable query={query} pages={pages} />
      </Card>
    </>
  );
}

function PaymentsTable({ query, pages }: { query: PaymentQuery; pages: ReturnType<typeof useCursorPages> }) {
  const payments = useOnlinePayments(query);
  const labels = useLeaseLabels(payments.data?.items.map((item) => item.leaseId) ?? []);
  if (payments.isPending) return <ListLoading label="Chargement des paiements en ligne" />;
  if (payments.isError || payments.data === undefined) return <LoadError title="Impossible de charger les paiements en ligne" />;
  if (payments.data.items.length === 0) return <NoRows>{query.status !== null || query.leaseId !== null ? 'Aucun paiement ne correspond à ces filtres.' : 'Aucun paiement en ligne pour le moment.'}</NoRows>;

  return (
    <>
      <Table aria-label="Paiements en ligne">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Lancé le</TableHeaderCell>
            <TableHeaderCell>Locataire</TableHeaderCell>
            <TableHeaderCell>Bail</TableHeaderCell>
            <TableHeaderCell>Montant</TableHeaderCell>
            <TableHeaderCell>Moyen</TableHeaderCell>
            <TableHeaderCell>Statut</TableHeaderCell>
            <TableHeaderCell>Référence</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {payments.data.items.map((item) => {
            const badge = paymentStatusBadge[item.status];
            return (
              <TableRow key={item.id}>
                <TableCell>{formatDateFr(item.createdAt)}</TableCell>
                <TableCell>{labels.tenantOf(item.leaseId, item.partyId)}</TableCell>
                <TableCell>{labels.referenceOf(item.leaseId)}</TableCell>
                <TableCell>{formatMoney(item.amount.amount, item.amount.currency)}</TableCell>
                <TableCell>{methodLabel[item.method]}</TableCell>
                <TableCell>
                  <span className="flex flex-col items-start gap-1">
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                    {item.failureCode === null ? null : <span className="text-caption text-fg-subtle">{`Échec : ${item.failureCode}`}</span>}
                  </span>
                </TableCell>
                <TableCell>{item.providerReference ?? '—'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <CursorPager pages={pages} nextCursor={payments.data.nextCursor} label="Pagination des paiements en ligne" />
    </>
  );
}
