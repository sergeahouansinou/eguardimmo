import { formatMoney } from '../../../format/money';
import type { Billing, PlanId, Subscription } from './schemas';

export interface Plan {
  id: PlanId;
  name: string;
  monthly: number;
  limits: { lots: number | null; users: number | null; signatures: number | null; storageMb: number };
  features: readonly string[];
  switchLabel: string;
}

export const PLANS: readonly Plan[] = [
  {
    id: 'decouverte',
    name: 'Découverte',
    monthly: 0,
    limits: { lots: 2, users: 1, signatures: 0, storageMb: 1_000 },
    features: ['2 lots', '1 utilisateur', 'Quittances et avis', 'Suivi des loyers'],
    switchLabel: 'Passer à Découverte',
  },
  {
    id: 'essentiel',
    name: 'Essentiel',
    monthly: 990,
    limits: { lots: 15, users: 3, signatures: 10, storageMb: 5_000 },
    features: ['15 lots', '3 utilisateurs', 'Relances automatiques', '10 signatures'],
    switchLabel: 'Passer à Essentiel',
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 2490,
    limits: { lots: null, users: null, signatures: null, storageMb: 50_000 },
    features: ['Lots illimités', 'Utilisateurs illimités', 'Paiement en ligne', 'Rapports et exports'],
    switchLabel: 'Passer à Pro',
  },
];

export const ANNUAL_MONTHS = 10;

export function planOf(id: PlanId): Plan {
  const plan = PLANS.find((candidate) => candidate.id === id);
  if (!plan) throw new RangeError(`Formule inconnue : ${id}`);
  return plan;
}

export function priceOf(plan: Plan, billing: Billing): number {
  return billing === 'annuel' ? plan.monthly * ANNUAL_MONTHS : plan.monthly;
}

export function priceLabel(minor: number, billing: Billing): { amount: string; unit: string } {
  if (minor === 0) return { amount: formatMoney(0, 'EUR'), unit: 'pour toujours' };
  return { amount: formatMoney(minor, 'EUR'), unit: billing === 'annuel' ? 'par an' : 'par mois' };
}

export function limitsExceeded(plan: Plan, usage: Subscription['usage']): string[] {
  const problems: string[] = [];
  if (plan.limits.lots !== null && usage.lots > plan.limits.lots) {
    problems.push(`${String(usage.lots)} lots utilisés pour ${String(plan.limits.lots)} inclus`);
  }
  if (plan.limits.users !== null && usage.users > plan.limits.users) {
    problems.push(`${String(usage.users)} utilisateurs pour ${String(plan.limits.users)} inclus`);
  }
  if (plan.limits.signatures !== null && usage.signatures > plan.limits.signatures) {
    problems.push(`${String(usage.signatures)} signatures ce mois pour ${String(plan.limits.signatures)} incluses`);
  }
  if (usage.storageMb > plan.limits.storageMb) problems.push('stockage au-delà de la capacité incluse');
  return problems;
}
