'use client';

import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Icon, StatCard, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@eguardimmo/ui';
import { Download } from 'lucide-react';
import { RentApiError } from './api/rentErrors';
import { useReceiptDownload } from './useReceiptDownload';
import { useReceipt } from './hooks';
import { methodLabel, moneyText, periodLabel } from './labels';
import type { RentReceipt } from './model';
import { rentPaths } from './paths';
import { DescriptionList, ListLoading, LoadError, NotFoundPanel, PageHeader, useGestionNavigation } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

export function ReceiptDetailPage({ id }: { id: string }) {
  const receipt = useReceipt(id);
  const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Loyers', href: rentPaths.installments }, { label: 'Quittances', href: rentPaths.receipts }];
  if (receipt.isError) {
    if (receipt.error instanceof RentApiError && receipt.error.kind === 'not_found') {
      return (
        <>
          <PageHeader crumbs={[...crumbs, { label: 'Introuvable' }]} title="Quittance introuvable" />
          <NotFoundPanel title="Cette quittance n’existe pas" description="Elle a peut-être été supprimée ou le lien est incorrect." backHref={rentPaths.receipts} backLabel="Retour aux quittances" />
        </>
      );
    }
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: 'Quittance' }]} title="Quittance" />
        <LoadError title={receipt.error?.message ?? 'La quittance n’a pas pu être chargée'} />
      </>
    );
  }
  if (!receipt.data) {
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: 'Quittance' }]} title="Quittance" />
        <ListLoading label="Chargement de la quittance" />
      </>
    );
  }
  return <Detail receipt={receipt.data} crumbs={crumbs} />;
}

function Detail({ receipt, crumbs }: { receipt: RentReceipt; crumbs: { label: string; href: string }[] }) {
  const { Link } = useGestionNavigation();
  const download = useReceiptDownload();
  const snapshot = receipt.snapshot;
  return (
    <>
      <PageHeader
        crumbs={[...crumbs, { label: receipt.number }]}
        title={`Quittance ${receipt.number}`}
        subtitle={receipt.periodStart && receipt.periodEnd ? `Loyer de ${periodLabel(receipt.periodStart, receipt.periodEnd)}` : undefined}
        badges={receipt.isVoid ? <Badge tone="danger">Nulle</Badge> : <Badge tone="success">Valable</Badge>}
        actions={<Button variant="secondary" onClick={() => { void download(receipt); }}><Icon icon={Download} />Télécharger le PDF</Button>}
      />
      {receipt.isVoid ? <Alert tone="warning" title="Quittance déclarée nulle">{`${receipt.voidReason ?? 'Un paiement a été annulé.'}${receipt.voidedAt ? ` (le ${formatDateFr(receipt.voidedAt.slice(0, 10))})` : ''}`}</Alert> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Loyer" value={moneyText(receipt.rent)} />
        <StatCard label="Charges" value={moneyText(receipt.charges)} />
        <StatCard label="TVA" value={moneyText(receipt.vat)} />
        <StatCard label="Total" value={moneyText(receipt.total)} />
      </div>
      <Card className="gap-3">
        <CardHeader><CardTitle as="h2">Informations</CardTitle></CardHeader>
        <CardContent>
          <DescriptionList
            termWidth="160px"
            items={[
              { term: 'Locataires', detail: receipt.tenants.join(', ') || '—' },
              { term: 'Lot', detail: [receipt.unitReference, receipt.propertyName, receipt.address].filter(Boolean).join(', ') || '—' },
              { term: 'Bail', detail: receipt.leaseReference ?? '—' },
              { term: 'Émise le', detail: formatDateFr(receipt.issuedOn) },
              ...(snapshot?.issuerName ? [{ term: 'Émetteur', detail: snapshot.issuerName }] : []),
              ...(snapshot?.paidOn ? [{ term: 'Soldée le', detail: formatDateFr(snapshot.paidOn) }] : []),
              { term: 'Échéance', detail: <Link href={rentPaths.installment(receipt.installmentId)} className="text-action-on-subtle underline-offset-2 hover:underline">Voir l’échéance</Link> },
              { term: 'Empreinte', detail: <span className="font-mono text-caption break-all">{receipt.fingerprint}</span> },
            ]}
          />
        </CardContent>
      </Card>
      {snapshot ? (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
          <Card role="region" aria-label="Lignes de la quittance" className="gap-3">
            <CardHeader><CardTitle as="h2">Lignes</CardTitle></CardHeader>
            <CardContent>
              <Table aria-label="Lignes de la quittance">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Libellé</TableHeaderCell>
                    <TableHeaderCell numeric>Montant</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {snapshot.lines.map((line) => (
                    <TableRow key={`${line.label}-${line.from}`}>
                      <TableCell>{line.label}</TableCell>
                      <TableCell numeric>{moneyText(line.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card role="region" aria-label="Paiements pris en compte" className="gap-3">
            <CardHeader><CardTitle as="h2">Paiements pris en compte</CardTitle></CardHeader>
            <CardContent>
              <Table aria-label="Paiements pris en compte">
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Reçu le</TableHeaderCell>
                    <TableHeaderCell>Mode</TableHeaderCell>
                    <TableHeaderCell numeric>Montant</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {snapshot.payments.map((payment) => (
                    <TableRow key={`${payment.receivedOn}-${String(payment.amount.amount)}`}>
                      <TableCell>{formatDateFr(payment.receivedOn)}</TableCell>
                      <TableCell>{methodLabel[payment.method]}</TableCell>
                      <TableCell numeric>{moneyText(payment.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : null}
      {snapshot?.mention ? <Alert tone="info" title="Mentions légales">{snapshot.mention}</Alert> : null}
    </>
  );
}
