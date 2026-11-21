import { formatMoney } from "@/features/shared/money";
import type { BillingPeriod, Plan } from "./subscriptionSchemas";

export function planPrice(plan: Plan, period: BillingPeriod): { amount: string; unit: string } {
  const minor = period === "yearly" ? plan.yearlyMinor : plan.monthlyMinor;
  return { amount: formatMoney(minor), unit: period === "yearly" ? "HT par an" : "HT par mois" };
}

export function formatStorage(mb: number): string {
  if (mb < 1000) return `${String(mb)} Mo`;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(mb / 1000)} Go`;
}

export function percentOf(used: number, limit: number): number {
  return limit <= 0 ? 0 : Math.round((used / limit) * 100);
}
