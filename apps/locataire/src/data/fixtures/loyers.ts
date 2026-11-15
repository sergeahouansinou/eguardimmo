import { addMonths } from '@/lib/dates';
import type { ChargesStatement, Installment, Mandate, Payment } from '../schemas/loyers';

export const DEMO_TODAY = '2026-11-13';
export const DEMO_NOW = '2026-11-13T21:42:00';

const FIRST_DUE = '2023-04-01';
const LAST_DUE = '2026-12-01';

const KNOWN_PAID_DAYS: Readonly<Record<string, string>> = {
  '2026-10': '2026-10-03',
  '2026-09': '2026-09-02',
  '2026-08': '2026-08-04',
  '2026-07': '2026-07-02',
  '2026-06': '2026-06-03',
};

export const PROVISIONS_CENTS = 8000;

export function rentFor(dueOn: string): number {
  if (dueOn >= '2026-04-01') return 77000;
  if (dueOn >= '2025-04-01') return 76200;
  if (dueOn >= '2024-04-01') return 75100;
  return 74000;
}

function monthId(dueOn: string): string {
  return dueOn.slice(0, 7);
}

export function receiptNumberFor(index: number, paidOn: string): string {
  return `QT-${paidOn.slice(0, 4)}-${String(356 + index).padStart(4, '0')}`;
}

export function paymentIdFor(index: number, paidOn: string): string {
  return `PAY-${paidOn.slice(0, 4)}-${String(888 + index).padStart(4, '0')}`;
}

export function buildInstallments(): Installment[] {
  const items: Installment[] = [];
  let paidIndex = 0;
  for (let due = FIRST_DUE; due <= LAST_DUE; due = addMonths(due, 1)) {
    const id = monthId(due);
    const rentCents = rentFor(due);
    if (due >= '2026-12-01') {
      items.push({ id, dueOn: due, rentCents, provisionsCents: PROVISIONS_CENTS, status: 'a_venir', paidOn: null, paymentId: null, receiptId: null });
    } else if (due === '2026-11-01') {
      items.push({ id, dueOn: due, rentCents, provisionsCents: PROVISIONS_CENTS, status: 'impaye', paidOn: null, paymentId: null, receiptId: null });
    } else {
      const paidOn = KNOWN_PAID_DAYS[id] ?? `${id}-0${String(2 + (paidIndex % 3))}`;
      items.push({
        id,
        dueOn: due,
        rentCents,
        provisionsCents: PROVISIONS_CENTS,
        status: 'paye',
        paidOn,
        paymentId: paymentIdFor(paidIndex, paidOn),
        receiptId: receiptNumberFor(paidIndex, paidOn),
      });
      paidIndex += 1;
    }
  }
  return items;
}

export function buildSeedPayments(installments: readonly Installment[]): Payment[] {
  return installments
    .filter((item) => item.status === 'paye' && item.paymentId && item.paidOn)
    .map((item) => ({
      id: item.paymentId ?? '',
      installmentId: item.id,
      amountCents: item.rentCents + item.provisionsCents,
      method: 'virement' as const,
      status: 'reussi' as const,
      createdAt: `${item.paidOn ?? ''}T09:02:00`,
      completedAt: `${item.paidOn ?? ''}T09:02:00`,
      receiptId: item.receiptId,
      failureReason: null,
    }));
}

export const FIRST_NEW_PAYMENT_NUMBER = 931;
export const FIRST_NEW_RECEIPT_NUMBER = 399;

export const chargesFixture: ChargesStatement = {
  year: 2025,
  provisionsPaidCents: 96000,
  actualCents: 93800,
  balanceCents: 2200,
  status: 'remboursee',
  settledOn: '2026-03-12',
  settlementLabel: 'Virement •••• 4417',
  currentProvisionCents: 8000,
  provisionNote: 'Inchangée depuis 2023',
  monthlyProvisionCents: 8000,
  lines: [
    { label: 'Eau froide', split: 'Consommation', amountCents: 28600 },
    { label: 'Chauffage collectif', split: 'Tantièmes, 64,2 m²', amountCents: 40250 },
    { label: 'Ordures ménagères', split: 'Tantièmes, 64,2 m²', amountCents: 9630 },
    { label: 'Entretien des parties communes', split: 'Tantièmes, 64,2 m²', amountCents: 11820 },
    { label: 'Ascenseur', split: 'Tantièmes, 64,2 m²', amountCents: 3500 },
  ],
};

export const mandateFixture: Mandate = {
  reference: 'MD-2026-0114',
  creditor: 'Gestion Les Tilleuls',
  status: 'a_signer',
  holder: null,
  ibanLast4: null,
  signedOn: null,
  amountCents: 85000,
  dayOfMonth: 1,
  noticeDays: 5,
};
