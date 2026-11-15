import { DEMO_TODAY, addMonths, daysBetween, formatPeriod } from "@/features/shared/dates";
import { mandantById } from "@/features/shared/directory";
import { formatMoney } from "@/features/shared/money";
import { PRIORITY_RANK } from "./labels";
import { OPEN_STATUSES } from "./schemas";
import type { Devis, Intervention } from "./schemas";

export type TabKey = "ouvertes" | "terminees" | "archivees";

export function tabOf(intervention: Intervention): TabKey {
  if (intervention.status === "terminee") return "terminees";
  if (intervention.status === "archivee") return "archivees";
  return "ouvertes";
}

export function sortInterventions(items: readonly Intervention[]): Intervention[] {
  return [...items].sort((a, b) => {
    const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (byPriority !== 0) return byPriority;
    return (a.dueOn ?? "9999-12-31").localeCompare(b.dueOn ?? "9999-12-31");
  });
}

export function ownerLabel(intervention: Intervention): string {
  return intervention.commonParts ? "Parties communes" : (mandantById(intervention.mandantId)?.name ?? "");
}

export function dueHint(dueOn: string | null): string {
  if (!dueOn) return "sans échéance";
  const days = daysBetween(DEMO_TODAY, dueOn);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  if (days > 1) return `dans ${String(days)} jours`;
  return `en retard de ${String(-days)} jour${days === -1 ? "" : "s"}`;
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count > 1 ? many : one}`;
}

export interface InterventionStats {
  openCount: number;
  openHint: string;
  pendingDevisCount: number;
  pendingDevisHint: string;
  lastMonthLabel: string;
  lastMonthCount: number;
  lastMonthHint: string;
}

export function interventionStats(items: readonly Intervention[], devis: readonly Devis[]): InterventionStats {
  const open = items.filter((item) => (OPEN_STATUSES as readonly string[]).includes(item.status));
  const urgent = open.filter((item) => item.priority === "urgente").length;
  const pending = devis.filter((item) => item.state === "a_soumettre");
  const first = pending[0];
  const lastMonth = addMonths(DEMO_TODAY, -1).slice(0, 7);
  const finished = items.filter((item) => item.status === "terminee" && item.completedOn?.startsWith(lastMonth));
  const durations = finished.map((item) => daysBetween(item.reportedOn, item.completedOn ?? item.reportedOn));
  const average = durations.length === 0 ? 0 : Math.round(durations.reduce((total, days) => total + days, 0) / durations.length);
  const trade = first ? first.title.replace(/^Devis /, "") : "";
  return {
    openCount: open.length,
    openHint: urgent === 0 ? "aucune urgence" : plural(urgent, "urgente", "urgentes"),
    pendingDevisCount: pending.length,
    pendingDevisHint:
      first ? `${trade.charAt(0).toUpperCase()}${trade.slice(1)} · ${formatMoney(first.totalMinor)}` : "tous les devis sont soumis",
    lastMonthLabel: formatPeriod(lastMonth).split(" ")[0]?.toLowerCase() ?? "",
    lastMonthCount: finished.length,
    lastMonthHint: durations.length === 0 ? "aucune intervention terminée" : `délai moyen de ${plural(average, "jour", "jours")}`,
  };
}
