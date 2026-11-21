'use client';

import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, StatCard, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Banknote } from 'lucide-react';
import { useInstallmentActions } from './InstallmentActions';
import { RentApiError } from './api/rentErrors';
import { LeaseBalanceCard } from './LeaseBalanceCard';
import { useInstallment, useRentPermissions } from './hooks';
import { installmentBadge, moneyText, periodLabel, receiptStateLabel } from './labels';
import type { RentInstallment } from './model';
import { rentPaths } from './paths';
import { DescriptionList, LinkButton, ListLoading, LoadError, NotFoundPanel, PageHeader, useGestionNavigation } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

export function InstallmentDetailPage({ id }: { id: string }) {
  const installment = useInstallment(id);
  const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Loyers', href: rentPaths.installments }];
  if (installment.isError) {
    if (installment.error instanceof RentApiError && installment.error.kind === 'not_found') {
      return (
        <>
          <PageHeader crumbs={[...crumbs, { label: 'Introuvable' }]} title="Échéance introuvable" />
          <NotFoundPanel title="Cette échéance n’existe pas" description="Elle a peut-être été supprimée ou le lien est incorrect." backHref={rentPaths.installments} backLabel="Retour aux loyers" />
        </>
      );
    }
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: 'Échéance' }]} title="Échéance" />
        <LoadError title={installment.error?.message ?? 'L’échéance n’a pas pu être chargée'} />
      </>
    );
  }
  if (!installment.data) {
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: 'Échéance' }]} title="Échéance" />
        <ListLoading label="Chargement de l’échéance" />
      </>
    );
  }
  return <Detail installment={installment.data} />;
}

function Detail({ installment }: { installment: RentInstallment }) {
  const permissions = useRentPermissions();
  const actions = useInstallmentActions();
  const badge = installmentBadge[installment.status];
  const period = periodLabel(installment.periodStart, installment.periodEnd);
  const items = actions.actionsFor(installment).filter((item) => item.id !== 'pay');
  const canPay = permissions.recordPayment && (installment.status === 'issued' || installment.status === 'partially_paid');

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Loyers', href: rentPaths.installments }, { label: period }]}
        title={`Échéance de ${period}`}
        subtitle={installment.leaseReference ? `Bail ${installment.leaseReference}` : undefined}
        badges={
          <>
            <Badge tone={badge.tone}>{badge.label}</Badge>
            {installment.isOverdue ? <Badge tone="danger">En retard</Badge> : null}
          </>
        }
        actions={
          <>
            {items.map((item) => (
              <Button key={item.id} variant={item.tone === 'danger' ? 'danger' : 'secondary'} onClick={item.onSelect}>{item.label}</Button>
            ))}
            {canPay ? <LinkButton href={rentPaths.newPayment(installment.leaseId)} variant="primary" icon={Banknote}>Enregistrer un paiement</LinkButton> : null}
          </>
        }
      />
      {installment.status === 'cancelled' ? (
        <Alert tone="warning" title="Échéance annulée">
          {`Annulée le ${formatDateFr(installment.cancelledOn)}${installment.cancellationReason ? ` : ${installment.cancellationReason}` : ''}.`}
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total appelé" value={moneyText(installment.total)} />
        <StatCard label="Reste dû" value={installment.outstanding ? moneyText(installment.outstanding) : '—'} tone={installment.outstanding && installment.outstanding.amount > 0 ? 'danger' : 'default'} />
        <StatCard label="Échéance" value={formatDateFr(installment.dueDate)} />
        <StatCard label="Avis émis le" value={formatDateFr(installment.issuedOn)} />
      </div>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <Card className="gap-3">
          <CardHeader><CardTitle as="h2">Documents</CardTitle></CardHeader>
          <CardContent>
            <DocumentsSection installment={installment} />
          </CardContent>
        </Card>
        <LeaseBalanceCard leaseId={installment.leaseId} />
      </div>
      <Card role="region" aria-label="Lignes de l’échéance" className="gap-3">
        <CardHeader><CardTitle as="h2">Lignes de l’échéance</CardTitle></CardHeader>
        <CardContent>
          <Table aria-label="Lignes de l’échéance">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Libellé</TableHeaderCell>
                <TableHeaderCell>Période</TableHeaderCell>
                <TableHeaderCell numeric>Jours</TableHeaderCell>
                <TableHeaderCell numeric>Montant mensuel</TableHeaderCell>
                <TableHeaderCell numeric>Montant</TableHeaderCell>
                <TableHeaderCell numeric>TVA</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(installment.lines ?? []).map((line) => (
                <TableRow key={line.id}>
                  <TableCell strong>{line.label}</TableCell>
                  <TableCell>{`${formatDateFr(line.from)} au ${formatDateFr(line.to)}`}</TableCell>
                  <TableCell numeric>{`${String(line.days)}/${String(line.monthDays)}`}</TableCell>
                  <TableCell numeric>{moneyText(line.monthlyAmount)}</TableCell>
                  <TableCell numeric>{moneyText(line.amount)}</TableCell>
                  <TableCell numeric>{moneyText(line.vatAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {actions.dialogs}
    </>
  );
}

function DocumentsSection({ installment }: { installment: RentInstallment }) {
  const { Link } = useGestionNavigation();
  return (
    <DescriptionList
      termWidth="140px"
      items={[
        { term: 'Avis d’échéance', detail: installment.notice ? `${installment.notice.number}, émis le ${formatDateFr(installment.notice.issuedOn)}` : 'Pas encore émis' },
        {
          term: 'Quittance',
          detail: installment.receipt ? (
            <Link href={rentPaths.receipt(installment.receipt.id)} className="text-action-on-subtle underline-offset-2 hover:underline">{`${installment.receipt.number}, émise le ${formatDateFr(installment.receipt.issuedOn)}`}</Link>
          ) : (
            receiptStateLabel[installment.receiptState]
          ),
        },
        { term: 'Loyer', detail: moneyText(installment.rent) },
        { term: 'Charges', detail: moneyText(installment.charges) },
        { term: 'TVA', detail: moneyText(installment.vat) },
      ]}
    />
  );
}
