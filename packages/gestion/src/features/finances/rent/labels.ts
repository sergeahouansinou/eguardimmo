import type { BadgeTone } from '@eguardimmo/ui';
import { formatMoney } from '../../../format/money';
import { formatDateFr, monthLabel } from '../../locataires/kit/dates';
import type { InstallmentStatus, Money, PaymentMethod, PaymentStatus, ReceiptState } from './model';

export const installmentBadge: Record<InstallmentStatus, { label: string; tone: BadgeTone }> = {
  upcoming: { label: 'À venir', tone: 'neutral' },
  issued: { label: 'Avis émis', tone: 'info' },
  partially_paid: { label: 'Partiellement payée', tone: 'warning' },
  paid: { label: 'Payée', tone: 'success' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

export const paymentBadge: Record<PaymentStatus, { label: string; tone: BadgeTone }> = {
  recorded: { label: 'Enregistré', tone: 'success' },
  cancelled: { label: 'Annulé', tone: 'neutral' },
};

export const methodLabel: Record<PaymentMethod, string> = {
  transfer: 'Virement',
  cheque: 'Chèque',
  cash: 'Espèces',
  direct_debit: 'Prélèvement',
};

export const receiptStateLabel: Record<ReceiptState, string> = {
  issued: 'Quittance émise',
  on_demand: 'Quittance à émettre sur demande',
  pending: 'Quittance en attente d’émission',
  not_due: 'Pas encore de quittance',
};

export const moneyText = (value: Money): string => formatMoney(value.amount, value.currency);

export function periodLabel(start: string, end: string): string {
  if (start.slice(0, 7) === end.slice(0, 7)) return monthLabel(start.slice(0, 7));
  return `${formatDateFr(start)} au ${formatDateFr(end)}`;
}
