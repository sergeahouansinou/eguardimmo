import type { ExpenseType, PaymentMode, PaymentNature } from './schemas';

export const MODE_LABELS: Record<PaymentMode, string> = {
  virement: 'Virement',
  prelevement: 'Prélèvement',
  especes: 'Espèces',
  cheque: 'Chèque',
  mobile_money: 'Mobile money',
  carte: 'Carte',
};

export const NATURE_LABELS: Record<PaymentNature, string> = {
  echeance: 'Paiement d’échéance',
  acompte_loyer: 'Acompte sur loyer',
  acompte_depot: 'Acompte sur dépôt de garantie',
  autre: 'Autre',
};

export const EXPENSE_LABELS: Record<ExpenseType, string> = {
  reparation: 'Réparation',
  entretien: 'Entretien',
  taxe: 'Taxe',
  assurance: 'Assurance',
  energie: 'Énergie',
  autre: 'Autre',
};

export const options = <T extends string>(labels: Record<T, string>) => (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
