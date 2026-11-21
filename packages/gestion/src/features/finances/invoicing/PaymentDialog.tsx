'use client';

import { Alert, Button, Dialog, DialogClose, DialogContent, Select, TextField } from '@eguardimmo/ui';
import { useRef, useState } from 'react';
import { InvoicingApiError } from './api/invoicingErrors';
import { amountHint, minorToInput, parseMinorUnits } from './amounts';
import { useRecordInvoicePayment } from './hooks';
import { documentName, methodLabel, moneyText } from './labels';
import { PAYMENT_METHODS } from './model';
import type { Invoice, PaymentMethod } from './model';
import { errorMessage, useNotify } from '../../locataires/kit';
import { formatDateFr, todayIso } from '../../locataires/kit/dates';

const methodOptions = PAYMENT_METHODS.map((method) => ({ value: method, label: methodLabel[method] }));
const isMethod = (value: string): value is PaymentMethod => PAYMENT_METHODS.some((method) => method === value);

export function PaymentDialog({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  return (
    <Dialog open={invoice !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Enregistrer un règlement" description={invoice ? `${documentName(invoice)} : reste dû ${invoice.outstanding ? moneyText(invoice.outstanding) : '—'}.` : ''} className="max-w-[480px]">
        {invoice?.outstanding ? <PaymentForm key={invoice.id} invoice={invoice} outstanding={invoice.outstanding} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({ invoice, outstanding, onClose }: { invoice: Invoice; outstanding: NonNullable<Invoice['outstanding']>; onClose: () => void }) {
  const record = useRecordInvoicePayment();
  const notify = useNotify();
  const today = todayIso();
  const { currency } = outstanding;
  const [amount, setAmount] = useState(minorToInput(outstanding.amount, currency));
  const [method, setMethod] = useState<PaymentMethod>('transfer');
  const [paidOn, setPaidOn] = useState(today);
  const [reference, setReference] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; paidOn?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef<{ signature: string; key: string } | null>(null);

  const keyFor = (signature: string): string => {
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: globalThis.crypto.randomUUID() };
    return attempt.current.key;
  };

  const submit = async () => {
    const minor = parseMinorUnits(amount, currency);
    const next: { amount?: string; paidOn?: string } = {};
    if (minor === null || minor <= 0) next.amount = `Indiquez un montant strictement positif. ${amountHint(currency)}.`;
    else if (minor > outstanding.amount) next.amount = `Le règlement dépasse le reste dû (${moneyText(outstanding)}).`;
    if (paidOn === '' || paidOn > today) next.paidOn = 'Indiquez une date de règlement, au plus tard aujourd’hui.';
    setErrors(next);
    setFailure(null);
    if (Object.keys(next).length > 0) return;
    try {
      const payment = await record.mutateAsync({
        invoiceId: invoice.id,
        input: { amount, currency, method, paidOn, reference, idempotencyKey: keyFor(JSON.stringify([amount, method, paidOn, reference])) },
      });
      notify({ title: payment.replayed === true ? 'Règlement déjà enregistré' : 'Règlement enregistré', description: `${moneyText(payment.amount)} reçus le ${formatDateFr(payment.paidOn)}.` });
      onClose();
    } catch (error) {
      if (error instanceof InvoicingApiError && error.kind === 'invalid' && 'amount' in error.fieldErrors) setErrors({ amount: error.message });
      setFailure(errorMessage(error));
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void submit();
      }}
    >
      <TextField label="Montant reçu *" placeholder={amountHint(currency)} inputMode="decimal" value={amount} error={errors.amount} onChange={(event) => { setAmount(event.target.value); }} data-autofocus />
      <Select label="Mode de règlement *" placeholder="Choisir un mode" options={methodOptions} value={method} onValueChange={(value) => { if (isMethod(value)) setMethod(value); }} />
      <TextField label="Date du règlement *" type="date" placeholder="AAAA-MM-JJ" max={today} min={invoice.issuedOn ?? '2000-01-01'} value={paidOn} error={errors.paidOn} onChange={(event) => { setPaidOn(event.target.value); }} />
      <TextField label="Référence" placeholder="Ex. VIR-20261116-0042" maxLength={120} value={reference} onChange={(event) => { setReference(event.target.value); }} />
      {failure ? <Alert tone="danger" title="Règlement non enregistré">{failure}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost">Retour</Button>
        </DialogClose>
        <Button type="submit" loading={record.isPending}>Enregistrer le règlement</Button>
      </div>
    </form>
  );
}
