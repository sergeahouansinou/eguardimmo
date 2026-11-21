import type { BadgeTone } from '@eguardimmo/ui';
import type { DeferralKind, FeeKind, InsuranceMode, LoanPurpose, LoanStatus, PrepaymentOption, ScheduleSource } from './model';

export const purposeLabel: Record<LoanPurpose, string> = {
  acquisition: 'Acquisition',
  works: 'Travaux',
  refinancing: 'Rachat de prêt',
  other: 'Autre',
};

export const deferralLabel: Record<DeferralKind, string> = {
  none: 'Aucun différé',
  partial: 'Différé partiel (intérêts seuls)',
  total: 'Différé total (intérêts capitalisés)',
};

export const insuranceLabel: Record<InsuranceMode, string> = {
  none: 'Sans assurance',
  initial_capital: 'Taux sur le capital initial',
  outstanding_capital: 'Taux sur le capital restant dû',
  fixed: 'Montant fixe par échéance',
};

export const statusLabel: Record<LoanStatus, string> = {
  active: 'En cours',
  repaid: 'Remboursé',
  archived: 'Archivé',
  voided: 'Saisie annulée',
};

export const statusTone: Record<LoanStatus, BadgeTone> = { active: 'success', repaid: 'info', archived: 'neutral', voided: 'danger' };

export const sourceLabel: Record<ScheduleSource, string> = { computed: 'Calculé par le serveur', imported: 'Tableau de la banque importé' };

export const feeLabel: Record<FeeKind, string> = {
  dossier: 'Frais de dossier',
  guarantee: 'Frais de garantie',
  mortgage: 'Frais d’hypothèque',
  prepayment_penalty: 'Indemnité de remboursement anticipé',
  other: 'Autres frais',
};

export const prepaymentLabel: Record<PrepaymentOption, string> = {
  reduce_term: 'Réduire la durée (mensualité inchangée)',
  reduce_payment: 'Réduire la mensualité (durée inchangée)',
};

export const rateLabel = (rate: string): string => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 5 }).format(Number(rate))} %`;
