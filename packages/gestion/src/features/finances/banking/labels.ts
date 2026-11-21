import type { BadgeTone } from '@eguardimmo/ui';
import { formatMoney } from '../../../format/money';
import { CODE_MESSAGES } from './api/bankingErrors';
import type { AccountStatus, Confidence, IgnoreReason, LedgerRole, LineState, Money, ReconciliationStatus, StatementSource, SuggestionAction } from './model';

export const moneyText = (money: Money, options: { signed?: boolean } = {}): string => formatMoney(money.amount, money.currency, options);

interface Badge {
  label: string;
  tone: BadgeTone;
}

export const ledgerRoleLabel: Record<LedgerRole, string> = {
  bank: 'Compte propre',
  trust_bank: 'Compte de tiers',
};

export const accountStatusBadge: Record<AccountStatus, Badge> = {
  active: { label: 'Suivi actif', tone: 'success' },
  closed: { label: 'Fermé', tone: 'neutral' },
};

export const sourceLabel: Record<StatementSource, string> = {
  camt053: 'camt.053',
  mt940: 'MT940',
  cfonb120: 'CFONB 120',
  csv: 'CSV',
  aggregator: 'Agrégateur',
};

export const lineStateLabel: Record<LineState, string> = {
  unmatched: 'À pointer',
  matched: 'Pointées',
  ignored: 'Ignorées',
};

export const confidenceBadge: Record<Confidence, Badge> = {
  exact: { label: 'Exacte', tone: 'success' },
  strong: { label: 'Forte', tone: 'info' },
  weak: { label: 'Faible', tone: 'warning' },
};

export const reconciliationStatusBadge: Record<ReconciliationStatus, Badge> = {
  draft: { label: 'Brouillon', tone: 'warning' },
  validated: { label: 'Validé', tone: 'success' },
  superseded: { label: 'Remplacé', tone: 'neutral' },
};

export const ignoreReasonLabel: Record<IgnoreReason, string> = {
  out_of_scope: 'Hors périmètre de l’agence',
  internal_transfer: 'Virement interne',
  bank_error: 'Erreur de la banque',
  other: 'Autre motif',
};

export const actionLabel: Record<SuggestionAction, string> = {
  match: 'Pointer avec une écriture existante',
  settle_lease: 'Créer l’encaissement du loyer',
  settle_invoice: 'Régler la facture',
  bank_charges: 'Créer les frais bancaires',
  ignore: 'Ignorer la ligne',
};

const EXPLANATIONS: Readonly<Record<string, string>> = {
  amount_equals_outstanding: 'montant égal au reste dû',
  notice_number_in_remittance: 'numéro d’avis d’échéance reconnu dans la référence',
  invoice_number_in_remittance: 'numéro de facture reconnu dans la référence',
  payout_number_in_remittance: 'numéro de reversement reconnu dans la référence',
  end_to_end_known: 'référence de bout en bout connue',
  tenant_name_in_label: 'nom du locataire reconnu dans le libellé',
  known_counterparty: 'contrepartie déjà connue',
  date_within_window: 'date proche de l’écriture',
  amount_equals_entry: 'montant égal à une écriture non pointée',
  organization_rule: 'règle de l’organisation',
  ambiguous: 'plusieurs candidats possibles : vérifiez avant de valider',
};

export function explanationText(codes: readonly string[]): string {
  const texts = codes.map((code) => EXPLANATIONS[code]).filter((text): text is string => text !== undefined);
  if (texts.length === 0) return 'Correspondance proposée par le serveur.';
  const joined = texts.join(', ');
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)}.`;
}

const REJECTED: Readonly<Record<string, string>> = {
  date_invalid: 'date illisible',
  amount_invalid: 'montant illisible',
  amount_zero: 'montant nul',
  label_missing: 'libellé absent',
};

export const rejectedLabel = (code: string): string => REJECTED[code] ?? 'ligne refusée';

const SKIPPED: Readonly<Record<string, string>> = {
  suggestion_not_found: 'Proposition périmée : recalculée depuis votre lecture.',
  not_acceptable: 'Proposition faible : à valider ligne par ligne.',
};

export const skippedReason = (code: string): string => SKIPPED[code] ?? CODE_MESSAGES[code] ?? 'Proposition écartée par le serveur.';

export const BALANCE_SOURCE_LABEL = {
  statement: 'Solde du relevé',
  chained: 'Solde chaîné depuis les relevés',
  entered: 'Solde saisi, avec pièce justificative',
} as const;
