import { toCsv } from "@/lib/csv";
import { formatDate } from "@/features/shared/dates";
import { STATE_LABELS } from "./labels";
import type { ReportRow } from "./schemas";

function amount(minor: number): string {
  return (minor / 100).toFixed(2).replace(".", ",");
}

export function reportsCsv(rows: readonly ReportRow[]): string {
  return toCsv(
    ["Mandant", "Type", "Période", "Loyers encaissés (€)", "Honoraires (€)", "Net à reverser (€)", "Dernier envoi", "État"],
    rows.map((row) => [
      row.mandantName,
      row.mandantKind,
      row.periodLabel,
      amount(row.collectedMinor),
      amount(row.feeMinor),
      amount(row.netMinor),
      row.lastSentOn ? `${formatDate(row.lastSentOn)}, ${row.lastSentShort ?? ""}` : "",
      STATE_LABELS[row.state],
    ]),
  );
}
