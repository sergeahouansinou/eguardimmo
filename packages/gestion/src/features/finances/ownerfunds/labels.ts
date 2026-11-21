import type { BadgeTone } from '@eguardimmo/ui';
import { formatMoney } from '../../../format/money';
import type { BatchStatus, DepositStatus, ExclusionReason, FeeKind, HoldKind, HoldReason, ItemStatus, Money, PayoutRequestStatus } from './model';

export const moneyText = (value: Money): string => formatMoney(value.amount, value.currency);

export const batchBadge: Record<BatchStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  validated: { label: 'Validé', tone: 'info' },
  executed: { label: 'Exécuté', tone: 'success' },
  cancelled: { label: 'Annulé', tone: 'neutral' },
};

export const itemBadge: Record<ItemStatus, { label: string; tone: BadgeTone }> = {
  included: { label: 'Inclus', tone: 'info' },
  excluded: { label: 'Exclu', tone: 'warning' },
  pending: { label: 'Virement à exécuter', tone: 'info' },
  paid: { label: 'Reversé', tone: 'success' },
  failed: { label: 'Échec du virement', tone: 'danger' },
  returned: { label: 'Retour bancaire', tone: 'danger' },
};

export const exclusionLabel: Record<ExclusionReason, string> = {
  no_payout_account: 'Aucun compte de paiement valide',
  account_recently_changed: 'Compte de paiement modifié récemment',
  negative_balance: 'Solde négatif',
  active_hold: 'Retenue active',
  below_minimum: 'Sous le minimum de reversement',
  before_payout_day: 'Avant le jour de reversement',
  trust_funds_gap: 'Écart de cantonnement',
  stale: 'Compte modifié depuis le brouillon',
  invoice_pdf_unavailable: 'Facture d’honoraires indisponible',
  invoice_not_issuable: 'Facture d’honoraires non émissible',
  nothing_to_pay: 'Rien à reverser',
  manual: 'Exclu à la main',
};

export const requestBadge: Record<PayoutRequestStatus, { label: string; tone: BadgeTone }> = {
  awaiting_code: { label: 'Code e-mail attendu', tone: 'neutral' },
  pending: { label: 'À valider', tone: 'warning' },
  approved: { label: 'Approuvée', tone: 'success' },
  rejected: { label: 'Refusée', tone: 'danger' },
  withdrawn: { label: 'Retirée', tone: 'neutral' },
  expired: { label: 'Expirée', tone: 'neutral' },
};

export const holdKindLabel: Record<HoldKind, string> = { full: 'Blocage total', reserve: 'Réserve' };

export const holdReasonLabel: Record<HoldReason, string> = {
  dispute: 'Litige',
  mandate_ending: 'Fin de mandat',
  works_reserve: 'Réserve pour travaux',
  succession: 'Succession',
  other: 'Autre motif',
};

export const depositBadge: Record<DepositStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'À confirmer', tone: 'warning' },
  confirmed: { label: 'Confirmé', tone: 'success' },
};

export const feeKindLabel: Record<FeeKind, string> = { percentage: 'Pourcentage', flat: 'Forfait' };

export function rateText(rateBp: number | null): string {
  if (rateBp === null) return '—';
  const whole = Math.trunc(rateBp / 100);
  const fraction = String(rateBp % 100).padStart(2, '0').replace(/0+$/, '');
  return `${fraction === '' ? String(whole) : `${String(whole)},${fraction}`} %`;
}

export const plural = (count: number, one: string, many: string): string => `${String(count)} ${count > 1 ? many : one}`;
