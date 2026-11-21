'use client';

import { Alert, Button, Card, Select, Textarea, TextField } from '@eguardimmo/ui';
import { useRef, useState } from 'react';
import { RentApiError } from './api/rentErrors';
import { amountHint, parseMinorUnits } from './api/rentPayloads';
import { useLeaseBalance, useRecordPayment } from './hooks';
import { methodLabel, moneyText } from './labels';
import { PAYMENT_METHODS } from './model';
import type { PaymentInput, PaymentMethod } from './model';
import { rentPaths } from './paths';
import { useLeaseChoices } from './useLeaseChoices';
import { LedgerLines, PageHeader, noticeAfterNavigation, useGestionNavigation } from '../../locataires/kit';
import { formatDateFr, todayIso } from '../../locataires/kit/dates';
import { links } from '../../locataires/kit/links';
import type { Currency } from '../../../format/money';

const CURRENCY_SYMBOL: Record<Currency, string> = { EUR: '€', XOF: 'FCFA', CAD: '$CA' };
const methodOptions = PAYMENT_METHODS.map((method) => ({ value: method, label: methodLabel[method] }));
const isMethod = (value: string): value is PaymentMethod => PAYMENT_METHODS.some((method) => method === value);

type Field = 'leaseId' | 'amount' | 'receivedOn' | 'reference' | 'note';
const API_FIELD: Readonly<Record<string, Field>> = { lease_id: 'leaseId', amount: 'amount', received_on: 'receivedOn', reference: 'reference', note: 'note' };

export function PaymentFormPage() {
  const { search, push } = useGestionNavigation();
  const choices = useLeaseChoices();
  const record = useRecordPayment();
  const today = todayIso();
  const [leaseId, setLeaseId] = useState(search.get('bail') ?? '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('transfer');
  const [receivedOn, setReceivedOn] = useState(today);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const attempt = useRef<{ signature: string; key: string } | null>(null);

  const balance = useLeaseBalance(leaseId === '' ? null : leaseId);
  const currency: Currency = balance.data?.balance.currency ?? 'EUR';
  const blocked = leaseId !== '' && (balance.isPending || balance.isError);

  const idempotencyKey = (signature: string): string => {
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: globalThis.crypto.randomUUID() };
    return attempt.current.key;
  };

  const submit = async () => {
    const next: Partial<Record<Field, string>> = {};
    const minor = parseMinorUnits(amount, currency);
    if (leaseId === '') next.leaseId = 'Choisissez le bail concerné.';
    if (minor === null || minor <= 0) next.amount = `Indiquez un montant strictement positif. ${amountHint(currency)}.`;
    if (receivedOn === '' || receivedOn > today) next.receivedOn = 'Indiquez une date de réception, au plus tard aujourd’hui.';
    setErrors(next);
    setFailure(null);
    if (Object.keys(next).length > 0) return;
    const input: PaymentInput = { leaseId, amount, currency, method, receivedOn, reference, note, idempotencyKey: idempotencyKey(JSON.stringify([leaseId, amount, currency, method, receivedOn, reference, note])) };
    try {
      const payment = await record.mutateAsync(input);
      const advance = payment.advance && payment.advance.amount > 0 ? ` ${moneyText(payment.advance)} sont conservés en avance sur le bail.` : '';
      noticeAfterNavigation({
        title: payment.replayed === true ? 'Paiement déjà enregistré' : 'Paiement enregistré',
        description: `${moneyText(payment.amount)} reçus le ${formatDateFr(payment.receivedOn)}.${advance}`,
      });
      push(`${rentPaths.payments}?bail=${encodeURIComponent(payment.leaseId)}`);
    } catch (error) {
      if (error instanceof RentApiError && error.kind === 'invalid') {
        const mapped = Object.keys(error.fieldErrors).flatMap((key) => (API_FIELD[key] ? [API_FIELD[key]] : []));
        if (mapped.length > 0) setErrors(Object.fromEntries(mapped.map((field) => [field, error.message])));
      }
      setFailure(error instanceof Error ? error.message : 'Le paiement n’a pas pu être enregistré. Réessayez.');
    }
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Accueil', href: links.home }, { label: 'Finances' }, { label: 'Loyers', href: rentPaths.installments }, { label: 'Paiements', href: rentPaths.payments }, { label: 'Nouveau paiement' }]}
        title="Enregistrer un paiement"
        subtitle="Le paiement est imputé du plus ancien au plus récent sur les échéances appelées ; le surplus est conservé en avance."
      />
      <Card className="gap-3 p-4">
        <form className="flex max-w-xl flex-col gap-3" noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <Select
            label="Bail *"
            placeholder="Choisir un bail, ex. BL-2026-0001"
            options={choices.options}
            value={leaseId}
            onValueChange={(value) => { setLeaseId(value); setErrors((current) => ({ ...current, leaseId: undefined })); }}
            searchable
            searchPlaceholder="Rechercher un bail"
            error={errors.leaseId}
          />
          {leaseId !== '' && balance.isError ? <Alert tone="danger" title="Le solde du bail n’a pas pu être chargé">{balance.error?.message}</Alert> : null}
          {balance.data ? (
            <Alert tone="info" title="Situation du bail">
              <LedgerLines
                lines={[
                  { label: 'Solde au grand livre', value: moneyText(balance.data.balance) },
                  { label: 'En retard', value: moneyText(balance.data.overdue) },
                  { label: 'Avance déjà détenue', value: moneyText(balance.data.advance) },
                ]}
              />
            </Alert>
          ) : null}
          <TextField
            label={`Montant reçu (${CURRENCY_SYMBOL[currency]}) *`}
            placeholder={amountHint(currency)}
            inputMode="decimal"
            value={amount}
            error={errors.amount}
            onChange={(event) => { setAmount(event.target.value); setErrors((current) => ({ ...current, amount: undefined })); }}
          />
          <Select label="Mode de règlement *" placeholder="Choisir un mode" options={methodOptions} value={method} onValueChange={(value) => { if (isMethod(value)) setMethod(value); }} />
          <TextField
            label="Date de réception *"
            type="date"
            placeholder="AAAA-MM-JJ"
            max={today}
            min="2000-01-01"
            value={receivedOn}
            error={errors.receivedOn}
            onChange={(event) => { setReceivedOn(event.target.value); setErrors((current) => ({ ...current, receivedOn: undefined })); }}
          />
          <TextField label="Référence" placeholder="Ex. VIR-20261116-0042" maxLength={120} value={reference} error={errors.reference} onChange={(event) => { setReference(event.target.value); }} />
          <Textarea label="Note" placeholder="Ex. Virement du locataire, reçu au relevé du 16/11" rows={3} maxLength={500} value={note} error={errors.note} onChange={(event) => { setNote(event.target.value); }} />
          {failure ? <Alert tone="danger" title="Paiement non enregistré">{failure}</Alert> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="submit" loading={record.isPending} disabled={blocked}>Enregistrer le paiement</Button>
          </div>
        </form>
      </Card>
    </>
  );
}
