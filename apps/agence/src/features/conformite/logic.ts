import { DEMO_TODAY, addMonths, daysBetween, monthsBetween } from "@/features/shared/dates";
import { CHANNEL_LABELS, RECIPIENT_OPTIONS } from "./schemas";
import type { Condition, Piece, Reminders } from "./schemas";

export type StatusLevel = "valid" | "renew" | "expired";
export type StatusTone = "success" | "warning" | "danger";

export interface PieceStatus {
  level: StatusLevel;
  label: string;
  tone: StatusTone;
}

export const ALERT_DAY_OPTIONS = [90, 60, 30, 15, 7] as const;

export function renewalThreshold(reminders: Reminders): number {
  return Math.max(...reminders.days);
}

export function daysLeft(piece: Piece, today: string = DEMO_TODAY): number {
  return daysBetween(today, piece.expiresOn);
}

export function pieceStatus(piece: Piece, threshold: number, today: string = DEMO_TODAY): PieceStatus {
  const days = daysLeft(piece, today);
  if (days < 0) return { level: "expired", label: "Échue", tone: "danger" };
  if (piece.renewable && days <= threshold) return { level: "renew", label: "À renouveler", tone: "warning" };
  return { level: "valid", label: piece.validLabel, tone: "success" };
}

function plural(count: number, unit: string): string {
  return `${String(count)} ${unit}${count > 1 ? "s" : ""}`;
}

export function remainingLabel(piece: Piece, today: string = DEMO_TODAY): string {
  const days = daysLeft(piece, today);
  if (days < 0) return `Échue depuis ${plural(-days, "jour")}`;
  if (days === 0) return "Aujourd’hui";
  if (days >= 180) return `${String(monthsBetween(today, piece.expiresOn))} mois`;
  return plural(days, "jour");
}

export function inDaysLabel(days: number): string {
  if (days < 0) return `échue depuis ${plural(-days, "jour")}`;
  if (days === 0) return "aujourd’hui";
  return `dans ${plural(days, "jour")}`;
}

function lastDayOfMonth(iso: string): string {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${iso.slice(0, 8)}${String(day).padStart(2, "0")}`;
}

function isLastDayOfMonth(iso: string): boolean {
  return lastDayOfMonth(iso) === iso;
}

export function recommendedFilingStart(expiresOn: string): string {
  const earlier = addMonths(expiresOn, -3);
  return isLastDayOfMonth(expiresOn) ? lastDayOfMonth(earlier) : earlier;
}

export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} et ${items.at(-1) ?? ""}`;
}

export function alertDaysLabel(days: readonly number[]): string {
  const sorted = [...days].sort((a, b) => b - a).map(String);
  return `${joinList(sorted)} jours avant l’échéance`;
}

export function recipientsLabel(ids: readonly string[]): string {
  return ids.map((id) => RECIPIENT_OPTIONS.find((option) => option.value === id)?.label ?? id).join(", ");
}

export function channelsLabel(channels: readonly ("email" | "app")[]): string {
  if (channels.length === 2) return CHANNEL_LABELS.both;
  return channels[0] === "email" ? CHANNEL_LABELS.email : CHANNEL_LABELS.app;
}

export interface Stats {
  total: number;
  withoutFile: number;
  valid: number;
  toRenew: readonly Piece[];
  next: Piece | undefined;
}

export function computeStats(pieces: readonly Piece[], threshold: number, today: string = DEMO_TODAY): Stats {
  const statuses = pieces.map((piece) => ({ piece, status: pieceStatus(piece, threshold, today) }));
  return {
    total: pieces.length,
    withoutFile: pieces.filter((piece) => piece.fileName === null).length,
    valid: statuses.filter((entry) => entry.status.level === "valid").length,
    toRenew: statuses.filter((entry) => entry.status.level !== "valid").map((entry) => entry.piece),
    next: [...pieces].sort((a, b) => a.expiresOn.localeCompare(b.expiresOn))[0],
  };
}

export interface ConditionView {
  id: string;
  title: string;
  detail: string;
  label: string;
  tone: StatusTone | "neutral";
}

export function conditionView(
  condition: Condition,
  pieces: readonly Piece[],
  threshold: number,
  formatDate: (iso: string) => string,
  today: string = DEMO_TODAY,
): ConditionView {
  const linked = condition.pieceId === null ? undefined : pieces.find((piece) => piece.id === condition.pieceId);
  if (linked) {
    const status = pieceStatus(linked, threshold, today);
    const dated = `${status.level === "valid" ? "Valable jusqu’au" : "Échéance le"} ${formatDate(linked.expiresOn)}`;
    return { id: condition.id, title: condition.title, detail: condition.detail ?? dated, label: status.label, tone: status.tone };
  }
  const manual = condition.manual ?? { label: "À vérifier", tone: "neutral" as const };
  return { id: condition.id, title: condition.title, detail: condition.detail ?? "", label: manual.label, tone: manual.tone };
}

export function piecesToRenew(piece: Piece, pieces: readonly Piece[], threshold: number, today: string = DEMO_TODAY): Piece[] {
  const candidates = [piece, ...piece.conditions.flatMap((condition) => pieces.filter((other) => other.id === condition.pieceId))];
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.id)) return false;
    seen.add(candidate.id);
    return candidate.renewable && pieceStatus(candidate, threshold, today).level !== "valid";
  });
}
