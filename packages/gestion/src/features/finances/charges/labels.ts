import { formatMoney } from '../../../format/money';
import type { BadgeTone } from '@eguardimmo/ui';
import type { ExerciseStatus, ExpenseKind, ExpenseSettlement, ExpenseStatus, KeyKind, Money, PlanBasis, StatementSettlement, StatementStatus } from './model';

export const moneyText = (money: Money, options: { signed?: boolean } = {}): string => formatMoney(money.amount, money.currency, options);

interface Badge {
  label: string;
  tone: BadgeTone;
}

export const expenseStatusBadge: Record<ExpenseStatus, Badge> = {
  pending_approval: { label: 'En attente de validation', tone: 'warning' },
  recorded: { label: 'Enregistrée', tone: 'success' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

export const exerciseStatusBadge: Record<ExerciseStatus, Badge> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  computed: { label: 'Calculé', tone: 'info' },
  issuing: { label: 'Émission en cours', tone: 'warning' },
  issued: { label: 'Émis', tone: 'success' },
  discarded: { label: 'Écarté', tone: 'neutral' },
};

export const statementStatusBadge: Record<StatementStatus, Badge> = {
  computed: { label: 'Aperçu', tone: 'info' },
  issued: { label: 'Émis', tone: 'success' },
  failed: { label: 'À reprendre', tone: 'danger' },
  superseded: { label: 'Remplacé', tone: 'neutral' },
};

export const settlementLabel: Record<ExpenseSettlement, string> = {
  bank: 'Banque',
  cash: 'Espèces',
  trust: 'Fonds du mandant',
  own_funds_advance: 'Avance de l’agence',
  paid_by_owner: 'Payée par le mandant',
  none: 'Sans règlement',
};

export const settlementHint: Record<ExpenseSettlement, string> = {
  bank: 'Payée par virement ou carte : écriture au grand livre.',
  cash: 'Payée en espèces : écriture au grand livre.',
  trust: 'Prélevée sur le solde du mandant : double authentification, validation d’un second membre au-delà du seuil.',
  own_funds_advance: 'Avancée par l’agence, créance sur le mandant : double authentification.',
  paid_by_owner: 'Réglée directement par le mandant (taxe foncière, par exemple) : aucune écriture, pièce obligatoire.',
  none: 'Relevé du syndic ou dépense sans flux : aucune écriture, pièce obligatoire.',
};

export const kindLabel: Record<ExpenseKind, string> = {
  payment: 'Pièce payée',
  co_ownership_statement: 'Relevé annuel du syndic',
};

export const keyKindLabel: Record<KeyKind, string> = {
  tantiemes: 'Tantièmes',
  surface: 'Surface',
  equal: 'Parts égales',
  consumption: 'Consommation',
  custom: 'Poids libres',
};

export const keyKindHint: Record<KeyKind, string> = {
  tantiemes: 'Un nombre de tantièmes par lot.',
  surface: 'La surface des lots est copiée à la création de la version.',
  equal: 'Chaque lot pèse 1.',
  consumption: 'Aucun poids : la quantité de chaque lot se saisit sur le poste.',
  custom: 'Un poids entier par lot.',
};

export const statementSettlementLabel: Record<StatementSettlement, string> = {
  next_installments: 'Ajouté aux prochains avis d’échéance',
  plan_12: 'Étalé sur douze mensualités',
  standalone_installment: 'Échéance ponctuelle (bail terminé)',
  credit: 'Crédit repris à l’avis suivant',
  none: 'Aucun règlement',
};

export const planBasisLabel: Record<PlanBasis, string> = {
  late_statement: 'Décompte tardif : demande de droit du locataire',
  agreement: 'Accord avec le locataire',
};

export const EXCLUSION_LABELS: Readonly<Record<string, string>> = {
  flat_rate: 'Bail au forfait de charges : non régularisé, la part reste au propriétaire.',
  no_provision: 'Bail sans provision de charges sur ce bien pendant la période.',
};

export const FAILURE_LABELS: Readonly<Record<string, string>> = {
  charges_pdf_unavailable: 'Le service de PDF était indisponible : reprenez l’émission, le numéro est conservé.',
  charges_issue_failed: 'Une erreur imprévue a interrompu l’émission de ce bail : reprenez-la.',
};

export const exclusionLabel = (reason: string): string => EXCLUSION_LABELS[reason] ?? reason;
export const failureLabel = (reason: string | null): string | null => (reason === null ? null : (FAILURE_LABELS[reason] ?? reason));

export function balanceLabel(balance: Money): string {
  if (balance.amount > 0) return `À payer par le locataire : ${moneyText(balance)}`;
  if (balance.amount < 0) return `À rendre au locataire : ${moneyText({ ...balance, amount: -balance.amount })}`;
  return 'Soldé';
}
