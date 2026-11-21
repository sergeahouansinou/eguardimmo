'use client';

import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, StatCard } from '@eguardimmo/ui';
import { InvoicingGate } from './InvoicingGate';
import { InvoiceLinesCard } from './InvoiceLinesCard';
import { InvoicePaymentsCard } from './InvoicePaymentsCard';
import { useInvoiceActions } from './InvoiceActions';
import { InvoicingApiError } from './api/invoicingErrors';
import { useInvoice, useInvoicingPermissions } from './hooks';
import { documentName, kindLabel, moneyText, statusBadge } from './labels';
import type { Invoice } from './model';
import { invoicingPaths } from './paths';
import { useRecipientDirectory } from './useRecipientDirectory';
import { DescriptionList, ListLoading, LoadError, NotFoundPanel, PageHeader, useGestionNavigation } from '../../locataires/kit';
import { formatDateFr } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';

export function InvoiceDetailPage({ id }: { id: string }) {
  return (
    <InvoicingGate>
      <Loader id={id} />
    </InvoicingGate>
  );
}

function Loader({ id }: { id: string }) {
  const invoice = useInvoice(id);
  const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Factures', href: invoicingPaths.invoices }];
  if (invoice.isError) {
    if (invoice.error instanceof InvoicingApiError && invoice.error.kind === 'not_found') {
      return (
        <>
          <PageHeader crumbs={[...crumbs, { label: 'Introuvable' }]} title="Facture introuvable" />
          <NotFoundPanel title="Cette facture n’existe pas" description="Le lien est peut-être incorrect, ou la facture appartient à une autre organisation." backHref={invoicingPaths.invoices} backLabel="Retour aux factures" />
        </>
      );
    }
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: 'Facture' }]} title="Facture" />
        <LoadError title={invoice.error?.message ?? 'La facture n’a pas pu être chargée'} />
      </>
    );
  }
  if (!invoice.data) {
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: 'Facture' }]} title="Facture" />
        <ListLoading label="Chargement de la facture" />
      </>
    );
  }
  return <Detail invoice={invoice.data} />;
}

function Detail({ invoice }: { invoice: Invoice }) {
  const permissions = useInvoicingPermissions();
  const { Link } = useGestionNavigation();
  const actions = useInvoiceActions({ redirectAfterDiscard: true });
  const directory = useRecipientDirectory();
  const badge = statusBadge[invoice.status];
  const title = invoice.number === null ? 'Brouillon de facture' : documentName(invoice);
  const items = actions.actionsFor(invoice);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Factures', href: invoicingPaths.invoices }, { label: invoice.number ?? 'Brouillon' }]}
        title={title}
        subtitle={directory.nameOf(invoice.recipientPartyId) ?? undefined}
        badges={
          <>
            <Badge tone={badge.tone}>{badge.label}</Badge>
            {invoice.isOverdue ? <Badge tone="danger">En retard</Badge> : null}
          </>
        }
        actions={items.map((item) => (
          <Button key={item.id} variant={item.id === 'issue' || item.id === 'pay' ? 'primary' : item.tone === 'danger' ? 'danger' : 'secondary'} onClick={item.onSelect}>{item.label}</Button>
        ))}
      />
      {invoice.status === 'discarded' ? <Alert tone="warning" title="Brouillon abandonné">Ce brouillon n’a jamais été émis : il ne porte aucun numéro et ne peut plus être modifié.</Alert> : null}
      {invoice.status === 'cancelled' ? <Alert tone="warning" title="Facture annulée">Un avoir couvre la totalité de cette facture.</Alert> : null}
      {invoice.kind === 'credit_note' ? (
        <Alert tone="info" title="Avoir">
          <span className="flex flex-wrap items-center gap-2">
            {invoice.creditReason ? `Motif : ${invoice.creditReason}.` : null}
            {invoice.creditedInvoiceId ? <Link href={invoicingPaths.invoice(invoice.creditedInvoiceId)} className="text-action-on-subtle underline-offset-2 hover:underline">Voir la facture d’origine</Link> : null}
          </span>
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total TTC" value={moneyText(invoice.totalGross)} />
        <StatCard label="Reste dû" value={invoice.outstanding ? moneyText(invoice.outstanding) : '—'} tone={invoice.outstanding && invoice.outstanding.amount > 0 && invoice.isOverdue ? 'danger' : 'default'} />
        <StatCard label="Échéance" value={formatDateFr(invoice.dueOn)} />
        <StatCard label="Émise le" value={formatDateFr(invoice.issuedOn)} />
      </div>
      <Card className="gap-3">
        <CardHeader><CardTitle as="h2">Informations</CardTitle></CardHeader>
        <CardContent>
          <DescriptionList
            termWidth="180px"
            items={[
              { term: 'Type', detail: kindLabel[invoice.kind] },
              { term: 'Destinataire', detail: directory.nameOf(invoice.recipientPartyId) ?? '—' },
              { term: 'Période de prestation', detail: invoice.serviceFrom || invoice.serviceTo ? `du ${formatDateFr(invoice.serviceFrom)} au ${formatDateFr(invoice.serviceTo)}` : '—' },
              { term: 'Envoi par e-mail', detail: invoice.sentAt ? `Envoi demandé le ${formatDateFr(invoice.sentAt)}` : 'Aucun envoi demandé' },
            ]}
          />
        </CardContent>
      </Card>
      <InvoiceLinesCard invoice={invoice} />
      {invoice.kind === 'invoice' && invoice.number !== null ? (
        <InvoicePaymentsCard invoice={invoice} canCancel={permissions.write} onCancel={(payment) => { actions.cancelPaymentFor(invoice, payment); }} />
      ) : null}
      {actions.dialogs}
    </>
  );
}
