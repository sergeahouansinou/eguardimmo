'use client';

import { Button, Select, Textarea, TextField } from '@eguardimmo/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { amountHint, lineNet, parseQuantityMilli, parseUnitPrice } from '../amounts';
import { useMaintenanceMutation, useTaxRates } from '../hooks';
import { decisionLabel, moneyText, quoteKindLabel } from '../labels';
import { APPROVAL_DECISIONS, QUOTE_KINDS } from '../model';
import type { ApprovalDecision, Currency, InvoiceTaxInput, QuoteKind, QuoteLineInput, Approval } from '../model';
import { AttachmentField, useAttachment } from './attachment';
import { FormDialog, stableKey, useSubmission } from './common';
import type { DialogProps } from './common';
import { todayIso } from '../../locataires/kit/dates';

const kindOptions = QUOTE_KINDS.map((value) => ({ value, label: quoteKindLabel[value] }));
const isKind = (value: string): value is QuoteKind => QUOTE_KINDS.some((candidate) => candidate === value);
const decisionOptions = APPROVAL_DECISIONS.map((value) => ({ value, label: decisionLabel[value] }));
const isDecision = (value: string): value is ApprovalDecision => APPROVAL_DECISIONS.some((candidate) => candidate === value);
const emptyLine = (): QuoteLineInput => ({ label: '', quantity: '1', unit: '', unitPrice: '', taxRateKey: '' });
const emptyTax = (): InvoiceTaxInput => ({ taxRateKey: '', base: '', tax: '' });

function computedNet(lines: readonly QuoteLineInput[], currency: Currency): number | null {
  let total = 0;
  for (const line of lines) {
    const quantity = parseQuantityMilli(line.quantity);
    const price = parseUnitPrice(line.unitPrice, currency);
    if (quantity === null || price === null) return null;
    total += lineNet(quantity, price);
  }
  return total;
}

export function QuoteDialog({ intervention, currency, onClose }: DialogProps & { currency: Currency }) {
  const add = useMaintenanceMutation((source, input: Parameters<typeof source.addQuote>[1]) => source.addQuote(intervention.id, input));
  const rates = useTaxRates();
  const attachment = useAttachment(intervention.id, 'quote');
  const submission = useSubmission();
  const today = todayIso();
  const [reference, setReference] = useState('');
  const [kind, setKind] = useState<QuoteKind>('initial');
  const [issuedOn, setIssuedOn] = useState(today);
  const [validUntil, setValidUntil] = useState('');
  const [message, setMessage] = useState('');
  const [lines, setLines] = useState<QuoteLineInput[]>([emptyLine()]);
  const rateOptions = (rates.data ?? []).map((rate) => ({ value: rate.key, label: rate.label }));
  const net = computedNet(lines, currency);
  const change = (index: number, patch: Partial<QuoteLineInput>) => { setLines((current) => current.map((line, position) => (position === index ? { ...line, ...patch } : line))); };

  return (
    <FormDialog
      open
      onClose={onClose}
      wide
      title="Enregistrer un devis"
      description="Joignez le devis du prestataire et saisissez ses lignes : le total est contrôlé par le serveur."
      submitLabel="Enregistrer le devis"
      submission={submission}
      onSubmit={() => {
        void submission.run(
          async () => {
            const fileId = await attachment.ensureUploaded();
            await add.mutateAsync({ reference, kind, issuedOn, validUntil, proposedOn: '', message, fileId: fileId ?? '', currency, lines });
          },
          { title: 'Devis enregistré' },
          onClose,
        );
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Référence du devis *" placeholder="Ex. DEV-778" maxLength={60} value={reference} onChange={(event) => { setReference(event.target.value); }} />
        <Select label="Type *" placeholder="Choisir" value={kind} onValueChange={(value) => { if (isKind(value)) setKind(value); }} options={kindOptions} />
        <TextField label="Émis le *" type="date" placeholder="AAAA-MM-JJ" max={today} value={issuedOn} onChange={(event) => { setIssuedOn(event.target.value); }} />
        <TextField label="Valable jusqu’au" type="date" placeholder="AAAA-MM-JJ" min={issuedOn} value={validUntil} onChange={(event) => { setValidUntil(event.target.value); }} />
      </div>
      <AttachmentField label="Devis du prestataire *" hint="PDF, JPEG ou PNG, 10 Mo au plus" file={attachment.file} onFile={attachment.setFile} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-caption text-fg-muted">Lignes du devis (hors taxe) *</legend>
        {lines.map((line, index) => (
          <div key={index} className="grid grid-cols-2 items-end gap-2 rounded-md border border-line p-2 sm:grid-cols-6">
            <div className="col-span-2 sm:col-span-6">
              <TextField label={`Libellé de la ligne ${String(index + 1)}`} placeholder="Ex. Remplacement du siphon" maxLength={200} value={line.label} onChange={(event) => { change(index, { label: event.target.value }); }} />
            </div>
            <div className="sm:col-span-1"><TextField label={`Quantité ${String(index + 1)}`} placeholder="1" inputMode="decimal" value={line.quantity} onChange={(event) => { change(index, { quantity: event.target.value }); }} /></div>
            <div className="sm:col-span-1"><TextField label={`Unité ${String(index + 1)}`} placeholder="u" maxLength={20} value={line.unit} onChange={(event) => { change(index, { unit: event.target.value }); }} /></div>
            <div className="sm:col-span-2"><TextField label={`Prix unitaire HT ${String(index + 1)}`} placeholder={amountHint(currency)} inputMode="decimal" value={line.unitPrice} onChange={(event) => { change(index, { unitPrice: event.target.value }); }} /></div>
            <div className="sm:col-span-2"><Select label={`Taux de taxe ${String(index + 1)}`} placeholder="Taux" value={line.taxRateKey} onValueChange={(value) => { change(index, { taxRateKey: value }); }} options={rateOptions} /></div>
            {lines.length > 1 ? (
              <div className="col-span-2 sm:col-span-6">
                <Button variant="ghost" size="sm" onClick={() => { setLines((current) => current.filter((_, position) => position !== index)); }}>
                  <Trash2 aria-hidden className="size-4" />
                  {`Retirer la ligne ${String(index + 1)}`}
                </Button>
              </div>
            ) : null}
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setLines((current) => [...current, emptyLine()]); }}>
            <Plus aria-hidden className="size-4" />
            Ajouter une ligne
          </Button>
          <span className="text-body text-fg-muted" aria-live="polite">{net === null ? 'Total HT : à compléter' : `Total HT calculé : ${moneyText({ amount: net, currency })}`}</span>
        </div>
      </fieldset>
      <Textarea label="Message du prestataire" placeholder="Précisions éventuelles" maxLength={500} rows={2} value={message} onChange={(event) => { setMessage(event.target.value); }} />
    </FormDialog>
  );
}

export function DecisionDialog({ intervention, approval, onClose }: DialogProps & { approval: Approval }) {
  const decide = useMaintenanceMutation((source, input: Parameters<typeof source.recordDecision>[2]) => source.recordDecision(intervention.id, approval.id, input));
  const attachment = useAttachment(intervention.id, 'proof');
  const submission = useSubmission();
  const [decision, setDecision] = useState<ApprovalDecision>('accept');
  const [comment, setComment] = useState('');
  return (
    <FormDialog
      open
      onClose={onClose}
      title="Enregistrer la décision du mandant"
      description={`Montant demandé : ${moneyText(approval.amount)}. La décision est valable à condition de joindre la pièce écrite du mandant.`}
      submitLabel="Enregistrer la décision"
      submission={submission}
      onSubmit={() => {
        void submission.run(
          async () => {
            const proofFileId = await attachment.ensureUploaded();
            const result = await decide.mutateAsync({ decision, comment, proofFileId });
            return result;
          },
          { title: 'Décision du mandant enregistrée' },
          onClose,
        );
      }}
    >
      <Select label="Décision *" placeholder="Choisir" value={decision} onValueChange={(value) => { if (isDecision(value)) setDecision(value); }} options={decisionOptions} />
      <AttachmentField label="Pièce écrite du mandant *" hint="Courriel, courrier ou message du mandant : PDF, JPEG ou PNG, 10 Mo au plus" file={attachment.file} onFile={attachment.setFile} />
      <Textarea label="Commentaire" placeholder="Condition ou précision donnée par le mandant" maxLength={500} rows={2} value={comment} onChange={(event) => { setComment(event.target.value); }} />
    </FormDialog>
  );
}

export function SupplierInvoiceDialog({ intervention, currency, onClose }: DialogProps & { currency: Currency }) {
  const record = useMaintenanceMutation((source, input: Parameters<typeof source.recordInvoice>[1]) => source.recordInvoice(intervention.id, input));
  const rates = useTaxRates();
  const attachment = useAttachment(intervention.id, 'invoice');
  const submission = useSubmission();
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const today = todayIso();
  const [number, setNumber] = useState('');
  const [invoiceOn, setInvoiceOn] = useState(today);
  const [dueOn, setDueOn] = useState('');
  const [taxes, setTaxes] = useState<InvoiceTaxInput[]>([emptyTax()]);
  const rateOptions = (rates.data ?? []).map((rate) => ({ value: rate.key, label: rate.label }));
  const change = (index: number, patch: Partial<InvoiceTaxInput>) => { setTaxes((current) => current.map((tax, position) => (position === index ? { ...tax, ...patch } : tax))); };

  return (
    <FormDialog
      open
      onClose={onClose}
      wide
      title="Enregistrer la facture du prestataire"
      description="Saisissez les bases et taxes par taux, comme sur la facture reçue."
      submitLabel="Enregistrer la facture"
      submission={submission}
      onSubmit={() => {
        void submission.run(
          async () => {
            const fileId = await attachment.ensureUploaded();
            const signature = JSON.stringify([number, invoiceOn, dueOn, taxes, fileId]);
            return record.mutateAsync({ idempotencyKey: stableKey(attempt, signature), number, invoiceOn, dueOn, fileId: fileId ?? '', currency, taxes });
          },
          { title: 'Facture enregistrée' },
          onClose,
        );
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField label="Numéro de facture *" placeholder="Ex. F-2026-118" maxLength={60} value={number} onChange={(event) => { setNumber(event.target.value); }} />
        <TextField label="Date de facture *" type="date" placeholder="AAAA-MM-JJ" max={today} value={invoiceOn} onChange={(event) => { setInvoiceOn(event.target.value); }} />
        <TextField label="Échéance" type="date" placeholder="AAAA-MM-JJ" min={invoiceOn} value={dueOn} onChange={(event) => { setDueOn(event.target.value); }} />
      </div>
      <AttachmentField label="Facture du prestataire *" hint="PDF, JPEG ou PNG, 10 Mo au plus" file={attachment.file} onFile={attachment.setFile} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-caption text-fg-muted">Bases et taxes par taux *</legend>
        {taxes.map((tax, index) => (
          <div key={index} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-3">
            <Select label={`Taux de taxe ${String(index + 1)}`} placeholder="Taux" value={tax.taxRateKey} onValueChange={(value) => { change(index, { taxRateKey: value }); }} options={rateOptions} />
            <TextField label={`Base HT ${String(index + 1)}`} placeholder={amountHint(currency)} inputMode="decimal" value={tax.base} onChange={(event) => { change(index, { base: event.target.value }); }} />
            <TextField label={`Taxe ${String(index + 1)}`} placeholder={amountHint(currency)} inputMode="decimal" value={tax.tax} onChange={(event) => { change(index, { tax: event.target.value }); }} />
          </div>
        ))}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setTaxes((current) => [...current, emptyTax()]); }}>
            <Plus aria-hidden className="size-4" />
            Ajouter un taux
          </Button>
          {taxes.length > 1 ? <Button variant="ghost" size="sm" onClick={() => { setTaxes((current) => current.slice(0, -1)); }}>Retirer le dernier taux</Button> : null}
        </div>
      </fieldset>
    </FormDialog>
  );
}
