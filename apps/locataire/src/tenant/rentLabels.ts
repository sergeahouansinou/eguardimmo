import type { Tone } from '@eguardimmo/shell';
import { formatDate, formatMonthYear } from '@/lib/dates';
import type { InstallmentStatus, PaymentMethod, PaymentStatus } from './rentModel';

export const INSTALLMENT_STATUS_VIEW: Record<InstallmentStatus, { label: string; tone: Tone }> = {
  issued: { label: 'Émis', tone: 'info' },
  partially_paid: { label: 'Partiellement payé', tone: 'warning' },
  paid: { label: 'Payé', tone: 'success' },
};

export const PAYMENT_STATUS_VIEW: Record<PaymentStatus, { label: string; tone: Tone }> = {
  recorded: { label: 'Enregistré', tone: 'success' },
  cancelled: { label: 'Annulé', tone: 'neutral' },
};

const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  transfer: 'Virement',
  cheque: 'Chèque',
  cash: 'Espèces',
  direct_debit: 'Prélèvement',
};

export const paymentMethodName = (method: PaymentMethod): string => PAYMENT_METHODS[method];

export const periodTitle = (start: string): string => formatMonthYear(start);

export const periodRange = (start: string, end: string): string => `du ${formatDate(start)} au ${formatDate(end)}`;

export const leaseName = (lease: { reference: string | null }): string => lease.reference ?? 'Bail';
