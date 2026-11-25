import { daysBetween } from "@/lib/dates";

export type DeadlineTone = "neutral" | "warning" | "danger";

export interface DeadlineStatus {
  tone: DeadlineTone;
  label: string;
}

const SOON_DAYS = 7;

export function deadlineStatus(deadlineIso: string, todayIso: string): DeadlineStatus {
  const left = daysBetween(todayIso, deadlineIso.slice(0, 10));
  if (left < 0) return { tone: "danger", label: left === -1 ? "En retard d’un jour" : `En retard de ${String(-left)} jours` };
  if (left === 0) return { tone: "danger", label: "À traiter aujourd’hui" };
  if (left <= SOON_DAYS) return { tone: "warning", label: left === 1 ? "Échéance demain" : `Échéance dans ${String(left)} jours` };
  return { tone: "neutral", label: `Échéance dans ${String(left)} jours` };
}
