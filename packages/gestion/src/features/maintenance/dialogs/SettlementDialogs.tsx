'use client';

import { Select, Textarea, TextField } from '@eguardimmo/ui';
import { useRef, useState } from 'react';
import { amountHint, minorToInput } from '../amounts';
import { useMaintenanceMutation } from '../hooks';
import { methodLabel, moneyText, targetLabel } from '../labels';
import { ALLOCATION_TARGETS, PAYMENT_METHODS } from '../model';
import type { AllocationTarget, PaymentMethod, SupplierInvoice } from '../model';
import { FormDialog, stableKey, useSubmission } from './common';
import type { DialogProps } from './common';
import { formatDateFr, todayIso } from '../../locataires/kit/dates';

const targetOptions = ALLOCATION_TARGETS.map((value) => ({ value, label: targetLabel[value] }));
const methodOptions = PAYMENT_METHODS.map((value) => ({ value, label: methodLabel[value] }));
const isTarget = (value: string): value is AllocationTarget => ALLOCATION_TARGETS.some((candidate) => candidate === value);
const isMethod = (value: string): value is PaymentMethod => PAYMENT_METHODS.some((candidate) => candidate === value);

export const allocatedTotal = (invoice: SupplierInvoice): number => invoice.allocations.filter((entry) => entry.cancelledAt === null).reduce((sum, entry) => sum + entry.shareAmount.amount, 0);
export const paidTotal = (invoice: SupplierInvoice): number => invoice.payments.filter((entry) => entry.cancelledAt === null).reduce((sum, entry) => sum + entry.amount.amount, 0);

export function AllocationDialog({ intervention, invoice, onClose }: DialogProps & { invoice: SupplierInvoice }) {
  const allocate = useMaintenanceMutation((source, input: Parameters<typeof source.allocate>[2]) => source.allocate(intervention.id, invoice.id, input));
  const submission = useSubmission();
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const { currency } = invoice.totalGross;
  const remaining = Math.max(invoice.totalGross.amount - allocatedTotal(invoice), 0);
  const [target, setTarget] = useState<AllocationTarget>('owner');
  const [shareAmount, setShareAmount] = useState(minorToInput(remaining, currency));
  const [wearPercent, setWearPercent] = useState('');
  const [basisNote, setBasisNote] = useState('');
  return (
    <FormDialog
      open
      onClose={onClose}
      title="Imputer la facture"
      description={`${invoice.number} : ${moneyText(invoice.totalGross)} TTC, reste à imputer ${moneyText({ amount: remaining, currency })}.`}
      submitLabel="Imputer"
      submission={submission}
      onSubmit={() => {
        const signature = JSON.stringify([target, shareAmount, wearPercent, basisNote]);
        void submission.run(
          () => allocate.mutateAsync({ idempotencyKey: stableKey(attempt, signature), target, shareAmount, currency, wearPercent, basisNote }),
          { title: 'Facture imputée' },
          onClose,
        );
      }}
    >
      <Select label="Imputer à *" placeholder="Choisir" value={target} onValueChange={(value) => { if (isTarget(value)) setTarget(value); }} options={targetOptions} />
      <TextField label="Part imputée TTC *" placeholder={amountHint(currency)} inputMode="decimal" value={shareAmount} onChange={(event) => { setShareAmount(event.target.value); }} />
      {target === 'deposit' ? <TextField label="Vétusté (%)" placeholder="Ex. 15" inputMode="decimal" value={wearPercent} onChange={(event) => { setWearPercent(event.target.value); }} /> : null}
      <Textarea label="Justification" placeholder="Base de l’imputation (constat, état des lieux)" maxLength={300} rows={2} value={basisNote} onChange={(event) => { setBasisNote(event.target.value); }} />
    </FormDialog>
  );
}

export function SupplierPaymentDialog({ intervention, invoice, onClose }: DialogProps & { invoice: SupplierInvoice }) {
  const pay = useMaintenanceMutation((source, input: Parameters<typeof source.recordPayment>[2]) => source.recordPayment(intervention.id, invoice.id, input));
  const submission = useSubmission();
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const today = todayIso();
  const { currency } = invoice.totalGross;
  const outstanding = Math.max(invoice.totalGross.amount - paidTotal(invoice), 0);
  const [amount, setAmount] = useState(minorToInput(outstanding, currency));
  const [method, setMethod] = useState<PaymentMethod>('transfer');
  const [paidOn, setPaidOn] = useState(today);
  const [reference, setReference] = useState('');
  return (
    <FormDialog
      open
      onClose={onClose}
      title="Enregistrer un règlement au prestataire"
      description={`${invoice.number} : reste à payer ${moneyText({ amount: outstanding, currency })}${invoice.dueOn ? `, échéance ${formatDateFr(invoice.dueOn)}` : ''}.`}
      submitLabel="Enregistrer le règlement"
      submission={submission}
      onSubmit={() => {
        const signature = JSON.stringify([amount, method, paidOn, reference]);
        void submission.run(
          () => pay.mutateAsync({ idempotencyKey: stableKey(attempt, signature), amount, currency, method, paidOn, reference }),
          { title: 'Règlement enregistré' },
          onClose,
        );
      }}
    >
      <TextField label="Montant réglé *" placeholder={amountHint(currency)} inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); }} />
      <Select label="Mode de règlement *" placeholder="Choisir" value={method} onValueChange={(value) => { if (isMethod(value)) setMethod(value); }} options={methodOptions} />
      <TextField label="Date du règlement *" type="date" placeholder="AAAA-MM-JJ" max={today} min={invoice.invoiceOn} value={paidOn} onChange={(event) => { setPaidOn(event.target.value); }} />
      <TextField label="Référence" placeholder="Ex. VIR-20261116-0042" maxLength={120} value={reference} onChange={(event) => { setReference(event.target.value); }} />
    </FormDialog>
  );
}
