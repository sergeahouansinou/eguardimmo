import { addDays, addMonths } from '@/lib/dates';
import { ibanLast4, normalizeIban } from '@/lib/iban';
import { SourceError } from '../errors';
import type { DemoState } from '../demoState';
import { chargesFixture } from '../fixtures/loyers';
import { mandateInputSchema, paymentOutcomeSchema, startPaymentInputSchema } from '../schemas/loyers';
import type { MandateInput, Payment, PaymentOutcome, Receipt, StartPaymentInput } from '../schemas/loyers';
import { pad4, run } from './run';

const METHOD_LABELS: Record<Payment['method'], string> = {
  carte: 'Carte bancaire',
  virement: 'Virement bancaire',
  prelevement: 'Prélèvement SEPA',
};

const KNOWN_FINGERPRINTS: Readonly<Record<string, string>> = { 'QT-2026-0398': '7b4e…a02d' };

function fingerprint(id: string): string {
  let hash = 0x811c9dc5;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  const hex = hash.toString(16).padStart(8, '0');
  return `${hex.slice(0, 4)}…${hex.slice(4)}`;
}

export function buildReceipt(state: DemoState, id: string): Receipt | null {
  const item = state.installments.find((candidate) => candidate.receiptId === id);
  if (!item?.paidOn) return null;
  const year = item.dueOn.slice(0, 4);
  const sameYear = state.installments.filter((candidate) => candidate.dueOn.startsWith(year) && candidate.dueOn <= item.dueOn);
  const called = sameYear.reduce((sum, candidate) => sum + candidate.rentCents + candidate.provisionsCents, 0);
  const received = sameYear
    .filter((candidate) => candidate.status === 'paye')
    .reduce((sum, candidate) => sum + candidate.rentCents + candidate.provisionsCents, 0);
  const payment = state.payments.find((candidate) => candidate.id === item.paymentId);
  const { lease } = state;
  return {
    id,
    number: id,
    issuedOn: item.paidOn,
    installmentId: item.id,
    periodStart: item.dueOn,
    periodEnd: addDays(addMonths(item.dueOn, 1), -1),
    paidOn: item.paidOn,
    landlord: lease.landlord,
    tenantName: lease.tenantName,
    propertyLabel: `${lease.property.label} · ${lease.property.type}`,
    address: lease.landlord.address,
    leaseNumber: lease.id,
    leaseStart: lease.startOn,
    leaseEnd: lease.endOn,
    paymentLabel: payment ? METHOD_LABELS[payment.method] : 'Virement bancaire',
    noticeNumber: `AV-${year}-${item.dueOn.slice(5, 7)}01-A1`,
    rentCents: item.rentCents,
    provisionsCents: item.provisionsCents,
    previousDebtCents: 0,
    totalReceivedCents: item.rentCents + item.provisionsCents,
    cumul: { calledCents: called, receivedCents: received, balanceCents: called - received, depositCents: lease.depositCents },
    seal: { fingerprint: KNOWN_FINGERPRINTS[id] ?? fingerprint(id), sealedAt: `${item.paidOn}T09:02:00` },
  };
}

function settle(state: DemoState, payment: Payment): void {
  const installment = state.installments.find((candidate) => candidate.id === payment.installmentId);
  if (!installment) throw new SourceError('introuvable', 'Échéance introuvable.');
  const receiptId = `QT-${state.today.slice(0, 4)}-${pad4(state.nextReceiptNumber)}`;
  state.nextReceiptNumber += 1;
  installment.status = 'paye';
  installment.paidOn = state.today;
  installment.paymentId = payment.id;
  installment.receiptId = receiptId;
  payment.status = 'reussi';
  payment.completedAt = state.now;
  payment.receiptId = receiptId;
  state.notifications.unshift({
    id: `n-${payment.id}`,
    tone: 'success',
    title: 'Paiement reçu',
    detail: `${payment.id} · quittance disponible`,
    unread: true,
    href: `/loyers/quittances/${receiptId}`,
  });
}

function pendingPayment(state: DemoState, id: string, expected: Payment['status']): Payment {
  const payment = state.payments.find((candidate) => candidate.id === id);
  if (!payment) throw new SourceError('introuvable', 'Paiement introuvable.');
  if (payment.status !== expected) throw new SourceError('etat_invalide', 'Ce paiement n’est plus dans l’état attendu.');
  return payment;
}

export function loyersOps(state: DemoState) {
  return {
    installments: () => run(() => state.installments),
    payment: (id: string) => run(() => state.payments.find((candidate) => candidate.id === id) ?? null),
    receipt: (id: string) => run(() => buildReceipt(state, id)),
    charges: () => run(() => chargesFixture),
    mandate: () => run(() => state.mandate),
    startPayment: (input: StartPaymentInput) =>
      run(() => {
        const { installmentId, method } = startPaymentInputSchema.parse(input);
        const installment = state.installments.find((candidate) => candidate.id === installmentId);
        if (installment?.status !== 'impaye') throw new SourceError('etat_invalide', 'Cette échéance n’est pas à régler.');
        if (method === 'prelevement' && state.mandate.status !== 'actif') {
          throw new SourceError('mandat_inactif', 'Aucun mandat de prélèvement actif.');
        }
        for (const payment of state.payments) {
          if (payment.installmentId === installmentId && payment.status === 'en_cours') payment.status = 'annule';
        }
        const payment: Payment = {
          id: `PAY-${state.today.slice(0, 4)}-${pad4(state.nextPaymentNumber)}`,
          installmentId,
          amountCents: installment.rentCents + installment.provisionsCents,
          method,
          status: 'en_cours',
          createdAt: state.now,
          completedAt: null,
          receiptId: null,
          failureReason: null,
        };
        state.nextPaymentNumber += 1;
        state.payments.push(payment);
        return payment;
      }),
    resolvePayment: (input: { paymentId: string; outcome: PaymentOutcome }) =>
      run(() => {
        const outcome = paymentOutcomeSchema.parse(input.outcome);
        const payment = pendingPayment(state, input.paymentId, 'en_cours');
        if (outcome === 'reussi') {
          if (payment.method === 'carte') {
            settle(state, payment);
          } else {
            payment.status = 'en_attente';
            const installment = state.installments.find((candidate) => candidate.id === payment.installmentId);
            if (installment) installment.status = 'en_attente';
          }
        } else if (outcome === 'echoue') {
          payment.status = 'echoue';
          payment.failureReason = 'Le prestataire de démonstration a refusé le paiement.';
        } else {
          payment.status = 'annule';
        }
        return payment;
      }),
    settlePayment: (paymentId: string) =>
      run(() => {
        const payment = pendingPayment(state, paymentId, 'en_attente');
        settle(state, payment);
        return payment;
      }),
    signMandate: (input: MandateInput) =>
      run(() => {
        const values = mandateInputSchema.parse(input);
        const last4 = ibanLast4(normalizeIban(values.iban));
        state.mandate = {
          ...state.mandate,
          status: 'actif',
          holder: values.holder,
          ibanLast4: last4,
          signedOn: state.today,
        };
        state.profile.bankHolder = values.holder;
        state.profile.bankLast4 = last4;
        return state.mandate;
      }),
    revokeMandate: () =>
      run(() => {
        if (state.mandate.status !== 'actif') throw new SourceError('etat_invalide', 'Aucun mandat actif à révoquer.');
        state.mandate = { ...state.mandate, status: 'revoque' };
        return state.mandate;
      }),
  };
}
