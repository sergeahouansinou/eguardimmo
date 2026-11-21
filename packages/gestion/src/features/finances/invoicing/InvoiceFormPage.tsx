'use client';

import { Alert, Button, Card, CardTitle, Select, TextField } from '@eguardimmo/ui';
import { useRef, useState } from 'react';
import { InvoicingGate } from './InvoicingGate';
import { InvoiceLinesEditor, newLine } from './InvoiceLinesEditor';
import type { EditableLine } from './InvoiceLinesEditor';
import { InvoicingApiError } from './api/invoicingErrors';
import { formatQuantity, minorToInput, previewNet } from './amounts';
import { useInvoice, useItemTerms, useSaveDraft } from './hooks';
import { moneyText } from './labels';
import type { Invoice } from './model';
import { invoicingPaths } from './paths';
import { useRecipientDirectory } from './useRecipientDirectory';
import { ListLoading, LoadError, NotFoundPanel, PageHeader, errorMessage, noticeAfterNavigation, useGestionNavigation } from '../../locataires/kit';
import { links } from '../../locataires/kit/links';
import type { Currency } from '../../../format/money';

const NEW_INVOICE_CURRENCY: Currency = 'EUR';

interface Initial {
  invoice: Invoice | null;
  recipientId: string;
  currency: Currency;
}

export function InvoiceFormPage({ id }: { id?: string }) {
  return (
    <InvoicingGate>
      {id === undefined ? <NewForm /> : <EditLoader id={id} />}
    </InvoicingGate>
  );
}

function NewForm() {
  const { search } = useGestionNavigation();
  return <DraftForm initial={{ invoice: null, recipientId: search.get('destinataire') ?? '', currency: NEW_INVOICE_CURRENCY }} />;
}

function EditLoader({ id }: { id: string }) {
  const invoice = useInvoice(id);
  const crumbs = [{ label: 'Accueil', href: links.home }, { label: 'Factures', href: invoicingPaths.invoices }];
  if (invoice.isError) {
    const missing = invoice.error instanceof InvoicingApiError && invoice.error.kind === 'not_found';
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: 'Modifier' }]} title="Modifier le brouillon" />
        {missing ? <NotFoundPanel title="Ce brouillon n’existe pas" description="Le lien est peut-être incorrect." backHref={invoicingPaths.invoices} backLabel="Retour aux factures" /> : <LoadError title={invoice.error?.message ?? 'Le brouillon n’a pas pu être chargé'} />}
      </>
    );
  }
  if (!invoice.data) {
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: 'Modifier' }]} title="Modifier le brouillon" />
        <ListLoading label="Chargement du brouillon" />
      </>
    );
  }
  if (invoice.data.status !== 'draft') {
    return (
      <>
        <PageHeader crumbs={[...crumbs, { label: 'Modifier' }]} title="Modifier le brouillon" />
        <NotFoundPanel title="Cette facture n’est plus un brouillon" description="Une facture émise ne se modifie plus : émettez un avoir pour la corriger." backHref={invoicingPaths.invoice(invoice.data.id)} backLabel="Voir la facture" />
      </>
    );
  }
  return <DraftForm key={invoice.data.lockVersion} initial={{ invoice: invoice.data, recipientId: invoice.data.recipientPartyId, currency: invoice.data.totalNet.currency }} />;
}

const linesOf = (invoice: Invoice | null): EditableLine[] =>
  invoice?.lines?.map((line) => newLine({ itemTermId: line.itemTermId, description: line.description, quantity: formatQuantity(line.quantityMilli), unitPrice: minorToInput(line.unitPrice.amount, line.unitPrice.currency), taxCategory: line.taxCategory })) ?? [newLine()];

function DraftForm({ initial }: { initial: Initial }) {
  const { push } = useGestionNavigation();
  const directory = useRecipientDirectory();
  const terms = useItemTerms();
  const save = useSaveDraft();
  const { invoice, currency } = initial;
  const [recipientId, setRecipientId] = useState(initial.recipientId);
  const [dueOn, setDueOn] = useState(invoice?.dueOn ?? '');
  const [serviceFrom, setServiceFrom] = useState(invoice?.serviceFrom ?? '');
  const [serviceTo, setServiceTo] = useState(invoice?.serviceTo ?? '');
  const [lines, setLines] = useState<EditableLine[]>(() => linesOf(invoice));
  const [recipientError, setRecipientError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef<{ signature: string; key: string } | null>(null);

  const keyFor = (signature: string): string => {
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: globalThis.crypto.randomUUID() };
    return attempt.current.key;
  };

  const termOptions = (terms.data ?? []).map((term) => ({ value: term.id, label: term.label }));
  const net = previewNet(lines, currency);
  const title = invoice ? 'Modifier le brouillon' : 'Nouvelle facture';

  const submit = async () => {
    setFailure(null);
    if (recipientId === '') {
      setRecipientError('Choisissez le destinataire de la facture.');
      return;
    }
    setRecipientError(undefined);
    const drafted = lines.map((line) => ({ itemTermId: line.itemTermId, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, taxCategory: line.taxCategory }));
    try {
      const saved = await save.mutateAsync({
        invoiceId: invoice?.id ?? null,
        lockVersion: invoice?.lockVersion ?? null,
        idempotencyKey: invoice ? null : keyFor(JSON.stringify([recipientId, dueOn, serviceFrom, serviceTo, drafted])),
        recipientPartyId: recipientId,
        leaseId: invoice?.leaseId ?? null,
        mandateId: invoice?.mandateId ?? null,
        currency,
        dueOn,
        serviceFrom,
        serviceTo,
        lines: drafted,
      });
      noticeAfterNavigation({ title: invoice ? 'Brouillon enregistré' : 'Brouillon créé', description: 'Relisez-le puis émettez la facture : le numéro est attribué à l’émission.' });
      push(invoicingPaths.invoice(saved.id));
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Factures', href: invoicingPaths.invoices }, { label: title }]}
        title={title}
        subtitle="Le numéro est attribué à l’émission, dans une suite continue. Les taxes et les totaux sont calculés par le serveur."
      />
      <form className="flex flex-col gap-3" noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <Card className="gap-3 p-4">
          <CardTitle as="h2">Destinataire et dates</CardTitle>
          <Select
            label="Destinataire *"
            placeholder="Choisir un mandant ou une partie"
            options={directory.options}
            value={recipientId}
            onValueChange={(value) => { setRecipientId(value); setRecipientError(undefined); }}
            searchable
            searchPlaceholder="Rechercher un destinataire"
            error={recipientError}
            hint={directory.failed ? 'La liste des destinataires n’a pas pu être chargée.' : undefined}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TextField label="Échéance de paiement" type="date" placeholder="AAAA-MM-JJ" hint="Laissée vide, l’échéance est calculée par le serveur." value={dueOn} onChange={(event) => { setDueOn(event.target.value); }} />
            <TextField label="Prestation du" type="date" placeholder="AAAA-MM-JJ" value={serviceFrom} onChange={(event) => { setServiceFrom(event.target.value); }} />
            <TextField label="Prestation au" type="date" placeholder="AAAA-MM-JJ" min={serviceFrom === '' ? undefined : serviceFrom} value={serviceTo} onChange={(event) => { setServiceTo(event.target.value); }} />
          </div>
        </Card>
        <Card className="gap-3 p-4">
          <CardTitle as="h2">Lignes</CardTitle>
          {terms.isError ? <Alert tone="danger" title="Les natures de ligne n’ont pas pu être chargées">{errorMessage(terms.error)}</Alert> : null}
          <InvoiceLinesEditor lines={lines} onChange={setLines} terms={termOptions} currency={currency} disabled={save.isPending} />
          <p className="text-body text-fg-muted" aria-live="polite">
            {net === null ? 'Total hors taxe indicatif : complétez les quantités et les prix.' : `Total hors taxe indicatif : ${moneyText({ amount: net, currency })}. La taxe est ajoutée par le serveur selon la catégorie de chaque ligne.`}
          </p>
        </Card>
        {failure ? <Alert tone="danger" title="Brouillon non enregistré">{failure}</Alert> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => { push(invoice ? invoicingPaths.invoice(invoice.id) : invoicingPaths.invoices); }}>Annuler</Button>
          <Button type="submit" loading={save.isPending}>Enregistrer le brouillon</Button>
        </div>
      </form>
    </>
  );
}
