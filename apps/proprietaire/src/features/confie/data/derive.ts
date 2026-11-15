import { daysBetween, formatDate } from "./dates";
import { eur } from "./money";
import type { ConfieData, Intervention, Lot, Report, Settlement } from "./schemas";

export const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

export function settlementTotals(settlement: Settlement) {
  const called = sum(settlement.lines.map((line) => line.called));
  const collected = sum(settlement.lines.map((line) => line.collected));
  const fees = sum(settlement.lines.map((line) => line.fees));
  return { called, collected, fees, works: settlement.works, reversed: collected - fees - settlement.works };
}

export function yearTotals(settlements: readonly Settlement[]) {
  const totals = settlements.map(settlementTotals);
  const paid = settlements.flatMap((settlement, index) => (settlement.status === "paid" ? [totals[index]] : []));
  const pending = settlements.flatMap((settlement, index) => (settlement.status === "pending" ? [totals[index]] : []));
  return {
    called: sum(totals.map((total) => total.called)),
    collected: sum(totals.map((total) => total.collected)),
    fees: sum(totals.map((total) => total.fees)),
    works: sum(totals.map((total) => total.works)),
    reversed: sum(totals.map((total) => total.reversed)),
    reversedPaid: sum(paid.map((total) => total?.reversed ?? 0)),
    pending: sum(pending.map((total) => total?.reversed ?? 0)),
  };
}

export type RentState =
  | { kind: "paid"; collected: number; called: number; paidOn: string | null }
  | { kind: "overdue"; collected: number; called: number; days: number }
  | { kind: "upcoming"; collected: number; called: number };

export function rentState(lot: Lot, today: string): RentState {
  const entry = lot.schedule.find((item) => item.month === today.slice(0, 7));
  if (!entry) return { kind: "upcoming", collected: 0, called: 0 };
  if (entry.collected >= entry.called) return { kind: "paid", collected: entry.collected, called: entry.called, paidOn: entry.paidOn };
  const days = daysBetween(entry.dueOn, today);
  if (days <= 0) return { kind: "upcoming", collected: entry.collected, called: entry.called };
  return { kind: "overdue", collected: entry.collected, called: entry.called, days };
}

export function rentStateLabel(state: RentState): string {
  if (state.kind === "paid") return "Payé";
  if (state.kind === "overdue") return `Impayé, ${String(state.days)} ${state.days > 1 ? "jours" : "jour"}`;
  return "À venir";
}

export const lotTotalRent = (lot: Lot): number => lot.rent.base + lot.rent.provisions;

export function findLot(data: ConfieData, id: string): Lot | undefined {
  return data.lots.find((lot) => lot.id === id);
}

export function lotLabel(data: ConfieData, id: string): string {
  return findLot(data, id)?.label ?? id;
}

export const pendingQuotes = (data: ConfieData): Intervention[] =>
  data.interventions.filter((item) => item.status === "quote_pending");

export const availableReports = (data: ConfieData): Report[] => data.reports.filter((report) => report.status !== "upcoming");

export const latestReport = (data: ConfieData): Report | undefined => availableReports(data)[0];

export const upcomingReport = (data: ConfieData): Report | undefined =>
  data.reports.find((report) => report.status === "upcoming");

export const unreadReports = (data: ConfieData): Report[] => data.reports.filter((report) => report.status === "new");

export function lastPaidSettlement(data: ConfieData): Settlement | undefined {
  return data.settlements.filter((settlement) => settlement.status === "paid").at(-1);
}

export function pendingSettlement(data: ConfieData): Settlement | undefined {
  return data.settlements.find((settlement) => settlement.status === "pending");
}

export function deriveCounts(data: ConfieData): Record<string, number> {
  return {
    biens: data.lots.length,
    "comptes-rendus": unreadReports(data).length,
    messages: data.unreadMessages,
    interventions: pendingQuotes(data).length,
  };
}

export interface NotificationItem {
  id: string;
  tone: "danger" | "warning" | "info" | "success";
  title: string;
  detail: string;
  unread: boolean;
  target: { kind: "intervention-devis"; id: string } | { kind: "compte-rendu"; id: string } | { kind: "loyers"; id: string } | { kind: "bien"; id: string };
}

export function deriveNotifications(data: ConfieData): NotificationItem[] {
  const read = new Set(data.readNotificationIds);
  const items: Omit<NotificationItem, "unread">[] = [];
  for (const quote of pendingQuotes(data)) {
    items.push({
      id: `devis-${quote.id}`,
      tone: "warning",
      title: "Un devis attend votre accord",
      detail: `${quote.category}, ${lotLabel(data, quote.lotId)} : ${eur(quote.totalTtc)} TTC`,
      target: { kind: "intervention-devis", id: quote.id },
    });
  }
  for (const report of unreadReports(data)) {
    items.push({
      id: `compte-rendu-${report.id}`,
      tone: "info",
      title: `Compte rendu ${report.label} disponible`,
      detail: `Disponible depuis le ${formatDate(report.availableOn)}`,
      target: { kind: "compte-rendu", id: report.id },
    });
  }
  for (const lot of data.lots) {
    const state = rentState(lot, data.today);
    if (state.kind === "overdue") {
      items.push({
        id: `impaye-${lot.id}`,
        tone: "danger",
        title: `${lot.label}, loyer impayé`,
        detail: `${eur(state.called - state.collected)}, ${rentStateLabel(state).replace("Impayé, ", "")} de retard`,
        target: { kind: "bien", id: lot.id },
      });
    }
  }
  const lastPaid = lastPaidSettlement(data);
  if (lastPaid) {
    items.push({
      id: `reversement-${lastPaid.month}`,
      tone: "success",
      title: `Reversement du ${formatDate(lastPaid.reversedOn)} effectué`,
      detail: `${eur(settlementTotals(lastPaid).reversed)} versés sur votre compte`,
      target: { kind: "loyers", id: lastPaid.month },
    });
  }
  return items.map((item) => ({ ...item, unread: !read.has(item.id) }));
}

export function reportTotals(report: Report) {
  return {
    called: sum(report.months.map((month) => month.called)),
    collected: sum(report.months.map((month) => month.collected)),
    fees: sum(report.months.map((month) => month.fees)),
    works: sum(report.months.map((month) => month.works)),
    reversed: sum(report.months.map((month) => month.collected - month.fees - month.works)),
  };
}
