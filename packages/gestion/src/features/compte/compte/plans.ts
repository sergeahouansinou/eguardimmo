import { formatMoney } from '../../../format/money';
import type { Billing, PlanId, Subscription } from './schemas';

export type Quota = number | 'illimite' | 'non-fixe';

export interface Plan {
  id: PlanId;
  name: string;
  monthly: number;
  yearly: number;
  limits: { lots: Quota; users: Quota; signatures: Quota; storageMb: number };
  features: readonly string[];
  switchLabel: string;
}

export const PLANS: readonly Plan[] = [
  {
    id: 'gratuit',
    name: 'Gratuit',
    monthly: 0,
    yearly: 0,
    limits: { lots: 1, users: 1, signatures: 'non-fixe', storageMb: 50 },
    features: ['1 lot', '1 utilisateur', '2 locataires, 2 baux, 4 états des lieux', '50 Mo de stockage'],
    switchLabel: 'Passer à Gratuit',
  },
  {
    id: 'silver',
    name: 'Silver',
    monthly: 490,
    yearly: 5_800,
    limits: { lots: 5, users: 'non-fixe', signatures: 10, storageMb: 500 },
    features: ['2 à 5 lots', 'Plusieurs utilisateurs', 'Locataires, baux et états des lieux illimités', '500 Mo de stockage', '10 signatures par mois'],
    switchLabel: 'Passer à Silver',
  },
  {
    id: 'gold',
    name: 'Gold',
    monthly: 1_090,
    yearly: 11_800,
    limits: { lots: 'illimite', users: 'non-fixe', signatures: 20, storageMb: 5_000 },
    features: ['Lots illimités', 'Plusieurs utilisateurs', 'Locataires, baux et états des lieux illimités', '5 Go de stockage', '20 signatures par mois'],
    switchLabel: 'Passer à Gold',
  },
];

export function planOf(id: PlanId): Plan {
  const plan = PLANS.find((candidate) => candidate.id === id);
  if (!plan) throw new RangeError(`Formule inconnue : ${id}`);
  return plan;
}

export function priceOf(plan: Plan, billing: Billing): number {
  return billing === 'annuel' ? plan.yearly : plan.monthly;
}

export function priceLabel(minor: number, billing: Billing): { amount: string; unit: string } {
  if (minor === 0) return { amount: formatMoney(0, 'EUR'), unit: 'pour toujours' };
  return { amount: formatMoney(minor, 'EUR'), unit: billing === 'annuel' ? 'par an' : 'par mois' };
}

export function limitsExceeded(plan: Plan, usage: Subscription['usage']): string[] {
  const problems: string[] = [];
  if (typeof plan.limits.lots === 'number' && usage.lots > plan.limits.lots) {
    problems.push(`${String(usage.lots)} lots utilisés pour ${String(plan.limits.lots)} inclus`);
  }
  if (typeof plan.limits.users === 'number' && usage.users > plan.limits.users) {
    problems.push(`${String(usage.users)} utilisateurs pour ${String(plan.limits.users)} inclus`);
  }
  if (typeof plan.limits.signatures === 'number' && usage.signatures > plan.limits.signatures) {
    problems.push(`${String(usage.signatures)} signatures ce mois pour ${String(plan.limits.signatures)} incluses`);
  }
  if (usage.storageMb > plan.limits.storageMb) problems.push('stockage au-delà de la capacité incluse');
  return problems;
}
