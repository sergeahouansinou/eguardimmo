import { formatDay } from "../format";
import type { StatementPeriod } from "./model";

const DAY_MS = 86_400_000;

// La fin renvoyée par le serveur est exclue de l'exercice : le dernier jour couvert est la veille.
export function lastDayOf(exclusiveEnd: string): string {
  const end = new Date(`${exclusiveEnd}T00:00:00Z`);
  return new Date(end.getTime() - DAY_MS).toISOString().slice(0, 10);
}

export function formatStatementPeriod(period: StatementPeriod | null): string {
  if (period === null) return "Non renseignée";
  return `Du ${formatDay(period.start)} au ${formatDay(lastDayOf(period.end))}`;
}
