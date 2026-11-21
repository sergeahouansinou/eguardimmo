import type { BadgeTone } from '@eguardimmo/ui';
import type { Currency } from '../../../format/money';

export const PAYMENT_STATUSES = ['pending', 'processing', 'succeeded', 'failed', 'cancelled', 'expired'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['card', 'direct_debit'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ACCOUNT_STATUSES = ['pending', 'ready', 'restricted'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export interface Money {
  amount: number;
  currency: Currency;
}

export interface OnlinePayment {
  id: string;
  leaseId: string;
  partyId: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amount: Money;
  installmentCount: number;
  provider: string;
  providerReference: string | null;
  failureCode: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

export interface PaymentAccount {
  provider: string;
  status: AccountStatus;
  ready: boolean;
  onboardedAt: string | null;
  onboardingUrl: string | null;
}

export interface PaymentQuery {
  cursor: string | null;
  status: PaymentStatus | null;
  leaseId: string | null;
}

export const paymentStatusBadge: Record<PaymentStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'En attente du locataire', tone: 'warning' },
  processing: { label: 'En cours de traitement', tone: 'info' },
  succeeded: { label: 'Réussi', tone: 'success' },
  failed: { label: 'Échoué', tone: 'danger' },
  cancelled: { label: 'Annulé', tone: 'neutral' },
  expired: { label: 'Expiré', tone: 'neutral' },
};

export const methodLabel: Record<PaymentMethod, string> = {
  card: 'Carte bancaire',
  direct_debit: 'Prélèvement SEPA',
};

export const accountBadge: Record<AccountStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Ouverture en cours', tone: 'warning' },
  ready: { label: 'Prêt à encaisser', tone: 'success' },
  restricted: { label: 'Restreint par le prestataire', tone: 'danger' },
};
