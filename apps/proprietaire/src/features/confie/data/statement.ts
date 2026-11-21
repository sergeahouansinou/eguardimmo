import { formatDate } from "./dates";
import { settlementTotals } from "./derive";
import { eurFixed } from "./money";
import type { Period } from "./period";
import type { ConfieData, Settlement } from "./schemas";
import type { StatementRowView } from "../ui/StatementView";

interface LedgerEntry {
  key: string;
  date: string;
  label: string;
  reference: string;
  source: string;
  debit: number;
  credit: number;
}

function entriesOf(data: ConfieData, settlement: Settlement): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  for (const line of settlement.lines) {
    if (line.collected <= 0) continue;
    const lot = data.lots.find((candidate) => candidate.id === line.lotId);
    const paidOn = lot?.schedule.find((item) => item.month === settlement.month)?.paidOn ?? null;
    entries.push({
      key: `${settlement.reference}-loyer-${line.lotId}`,
      date: paidOn ?? `${settlement.month}-28`,
      label: `Loyer encaissé, ${lot?.label ?? line.lotId}`,
      reference: `ENC-${settlement.month}-${String(lot?.lotNumber ?? 0)}`,
      source: "Encaissement",
      debit: 0,
      credit: line.collected,
    });
  }
  if (settlement.status !== "paid") return entries;
  const totals = settlementTotals(settlement);
  const at = settlement.reversedOn;
  const outflow = (suffix: string, label: string, source: string, amount: number): LedgerEntry[] =>
    amount > 0 ? [{ key: `${settlement.reference}-${suffix}`, date: at, label, reference: settlement.reference, source, debit: amount, credit: 0 }] : [];
  return [
    ...entries,
    ...outflow("honoraires", "Honoraires de gestion", "Honoraires prélevés", totals.fees),
    ...outflow("travaux", "Travaux déduits du reversement", "Facture de prestataire", totals.works),
    ...outflow("reversement", "Reversement sur votre compte", "Reversement", totals.reversed),
  ];
}

export interface DemoStatement {
  opening: string;
  closing: string;
  rows: StatementRowView[];
}

export function buildStatement(data: ConfieData, period: Period): DemoStatement {
  const ledger = data.settlements.flatMap((settlement) => entriesOf(data, settlement)).sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
  let balance = 0;
  let opening = 0;
  const rows: StatementRowView[] = [];
  for (const entry of ledger) {
    if (entry.date < period.from) {
      balance += entry.credit - entry.debit;
      opening = balance;
      continue;
    }
    if (entry.date > period.to) break;
    balance += entry.credit - entry.debit;
    rows.push({
      key: entry.key,
      date: formatDate(entry.date),
      label: entry.label,
      reference: entry.reference,
      source: entry.source,
      reversal: false,
      debit: entry.debit === 0 ? null : eurFixed(entry.debit),
      credit: entry.credit === 0 ? null : eurFixed(entry.credit),
      balance: eurFixed(balance),
    });
  }
  return { opening: eurFixed(opening), closing: eurFixed(balance), rows };
}
