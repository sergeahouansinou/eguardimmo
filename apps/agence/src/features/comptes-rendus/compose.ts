import { PAYOUT_DAY, DEFAULT_FEE_BASIS_POINTS } from "@/features/shared/agencyDefaults";
import { DEMO_TODAY, addDays, addMonths, formatDate, formatPeriod, periodOf } from "@/features/shared/dates";
import { lotsOfMandant, tenantById } from "@/features/shared/directory";
import type { Mandant } from "@/features/shared/directory";
import { applyRate, sum } from "@/features/shared/money";
import type { MandantStatement, StatementLine } from "@/features/shared/statement";
import type { PeriodKind } from "./schemas";

export const CURRENT_PERIOD = periodOf(DEMO_TODAY);
export const MAX_MONTHS = 12;

export function monthsInRange(from: string, to: string): string[] {
  const months: string[] = [];
  let cursor = `${periodOf(from)}-01`;
  while (cursor.slice(0, 7) <= periodOf(to) && months.length <= MAX_MONTHS) {
    months.push(cursor.slice(0, 7));
    cursor = addMonths(cursor, 1);
  }
  return months;
}

export function periodKeyOf(kind: PeriodKind, from: string, to: string): string {
  return kind === "mensuel" ? periodOf(from) : `${from}-au-${to}`;
}

export function periodLabelOf(kind: PeriodKind, from: string, to: string): string {
  return kind === "mensuel" ? formatPeriod(periodOf(from)) : `Du ${formatDate(from)} au ${formatDate(to)}`;
}

export function periodShortOf(kind: PeriodKind, from: string, to: string): string {
  return kind === "mensuel" ? (formatPeriod(periodOf(from)).split(" ")[0]?.toLowerCase() ?? "") : `du ${formatDate(from)} au ${formatDate(to)}`;
}

export function lastDayOf(month: string): string {
  return addDays(addMonths(`${month}-01`, 1), -1);
}

export function transferDateOf(month: string): string {
  return `${addMonths(`${month}-01`, 1).slice(0, 7)}-${String(PAYOUT_DAY).padStart(2, "0")}`;
}

export function syntheticStatement(mandant: Mandant, month: string): MandantStatement {
  const lines: StatementLine[] = lotsOfMandant(mandant.id).map((lot) => {
    const called = lot.rentMinor + lot.chargesMinor;
    const fee = applyRate(called, DEFAULT_FEE_BASIS_POINTS);
    return {
      lotId: lot.id,
      lotLabel: lot.label,
      lotDescription: lot.description,
      tenantName: tenantById(lot.tenantId)?.name ?? "",
      paidOn: `${month}-05`,
      calledMinor: called,
      collectedMinor: called,
      feeMinor: fee,
      netMinor: called - fee,
      unpaidSince: null,
      reminders: 0,
    };
  });
  return totals(mandant, month, lines, transferDateOf(month));
}

function totals(mandant: Pick<Mandant, "id" | "name" | "kind" | "mandateRef" | "ibanLast4">, period: string, lines: StatementLine[], transferDate: string): MandantStatement {
  return {
    mandantId: mandant.id,
    mandantName: mandant.name,
    mandantKind: mandant.kind,
    mandateRef: mandant.mandateRef,
    ibanLast4: mandant.ibanLast4,
    period,
    feeRateBasisPoints: DEFAULT_FEE_BASIS_POINTS,
    lines,
    calledMinor: sum(lines.map((line) => line.calledMinor)),
    collectedMinor: sum(lines.map((line) => line.collectedMinor)),
    feeMinor: sum(lines.map((line) => line.feeMinor)),
    netMinor: sum(lines.map((line) => line.netMinor)),
    worksDeductedMinor: 0,
    receipts: lines.filter((line) => line.collectedMinor > 0).length,
    transferDate,
  };
}

function latest(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a > b ? a : b;
}

function earliest(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a < b ? a : b;
}

export function mergeStatements(parts: readonly MandantStatement[], period: string): MandantStatement | null {
  const first = parts[0];
  const last = parts.at(-1);
  if (!first || !last) return null;
  if (parts.length === 1) return { ...first, period };
  const byLot = new Map<string, StatementLine>();
  parts.forEach((part) => {
    part.lines.forEach((line) => {
      const current = byLot.get(line.lotId);
      byLot.set(
        line.lotId,
        current
          ? {
              ...current,
              paidOn: latest(current.paidOn, line.paidOn),
              calledMinor: current.calledMinor + line.calledMinor,
              collectedMinor: current.collectedMinor + line.collectedMinor,
              feeMinor: current.feeMinor + line.feeMinor,
              netMinor: current.netMinor + line.netMinor,
              unpaidSince: earliest(current.unpaidSince, line.unpaidSince),
              reminders: current.reminders + line.reminders,
            }
          : line,
      );
    });
  });
  const merged = totals(
    { id: first.mandantId, name: first.mandantName, kind: first.mandantKind, mandateRef: first.mandateRef, ibanLast4: first.ibanLast4 },
    period,
    [...byLot.values()],
    last.transferDate,
  );
  return { ...merged, worksDeductedMinor: sum(parts.map((part) => part.worksDeductedMinor)) };
}

export function receiptsOf(statement: MandantStatement) {
  return statement.lines
    .filter((line) => line.collectedMinor > 0 && line.paidOn !== null)
    .map((line) => ({
      reference: `Q-${(line.paidOn ?? "").slice(0, 7)}-${line.lotId.toUpperCase()}`,
      lotLabel: line.lotLabel,
      tenantName: line.tenantName,
      paidOn: line.paidOn ?? "",
      amountMinor: line.collectedMinor,
    }));
}

export function remindersOf(statement: MandantStatement) {
  return statement.lines.flatMap((line) => {
    const since = line.unpaidSince;
    if (since === null) return [];
    return Array.from({ length: line.reminders }, (_, index) => {
      const planned = addDays(since, 3 + index * 4);
      return {
        lotLabel: line.lotLabel,
        tenantName: line.tenantName,
        rank: index + 1,
        sentOn: planned > DEMO_TODAY ? DEMO_TODAY : planned,
      };
    });
  });
}
