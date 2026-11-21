import type { BadgeTone } from '@eguardimmo/ui';
import { formatMoney } from '../../../format/money';
import type { InvoiceKind, InvoiceStatus, Money, PaymentMethod, TaxCategory } from './model';

export const statusBadge: Record<InvoiceStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  issued: { label: 'Émise', tone: 'info' },
  partially_paid: { label: 'Partiellement réglée', tone: 'warning' },
  paid: { label: 'Réglée', tone: 'success' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
  discarded: { label: 'Abandonnée', tone: 'neutral' },
};

export const kindLabel: Record<InvoiceKind, string> = { invoice: 'Facture', credit_note: 'Avoir' };

export const kindPlural: Record<InvoiceKind, string> = { invoice: 'Factures', credit_note: 'Avoirs' };

export const methodLabel: Record<PaymentMethod, string> = {
  transfer: 'Virement',
  cheque: 'Chèque',
  cash: 'Espèces',
  direct_debit: 'Prélèvement',
};

export const taxCategoryLabel: Record<TaxCategory, string> = {
  S: 'Taux normal',
  Z: 'Taux zéro',
  E: 'Exonéré',
  AE: 'Autoliquidation',
  O: 'Hors champ de la taxe',
};

export const moneyText = (value: Money): string => formatMoney(value.amount, value.currency);

export const documentName = (invoice: { kind: InvoiceKind; number: string | null }): string =>
  invoice.number === null ? kindLabel[invoice.kind] : `${kindLabel[invoice.kind]} ${invoice.number}`;
