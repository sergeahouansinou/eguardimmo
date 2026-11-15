import { formatMoney } from "@/features/shared/money";
import type { BillingPeriod, Plan } from "./subscriptionSchemas";

export function planPrice(plan: Plan, period: BillingPeriod): { amount: string; unit: string } | null {
  const minor = period === "yearly" ? plan.yearlyMinor : plan.monthlyMinor;
  if (minor === null) return null;
  return { amount: formatMoney(minor), unit: period === "yearly" ? "HT par an" : "HT par mois" };
}

export function planFeatures(plan: Plan): readonly string[] {
  if (plan.lots === null || plan.seats === null) return ["Lots illimités", "Équipe illimitée", ...plan.features];
  return [`${String(plan.lots)} lots`, `${String(plan.seats)} collaborateurs`, ...plan.features];
}

export function formatStorage(mb: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(mb / 1000)} Go`;
}

export function percentOf(used: number, limit: number): number {
  return limit <= 0 ? 0 : Math.round((used / limit) * 100);
}
