import { Badge } from "@eguardimmo/ui";
import Link from "next/link";
import { DataTable } from "@/features/kit";
import type { Column } from "@/features/kit";
import { formatDate } from "@/features/shared/dates";
import { JOURNAL_LABELS, sourceLabel } from "./labels";
import { entryHref } from "./paths";
import type { EntrySummary } from "./schemas";

const COLUMNS: readonly Column<EntrySummary>[] = [
  {
    id: "reference",
    header: "Référence",
    role: "title",
    cell: (entry) => (
      <Link href={entryHref(entry.id)} className="inline-flex min-h-11 items-center text-action-on-subtle underline underline-offset-2">
        {entry.reference}
        <span className="sr-only">, {entry.label}</span>
      </Link>
    ),
  },
  { id: "date", header: "Date", cell: (entry) => formatDate(entry.date) },
  { id: "journal", header: "Journal", cell: (entry) => <Badge>{JOURNAL_LABELS[entry.journal]}</Badge> },
  { id: "label", header: "Libellé", cell: (entry) => entry.label },
  { id: "source", header: "Origine", cell: (entry) => sourceLabel(entry.sourceType) },
  {
    id: "lines",
    header: "Lignes",
    numeric: true,
    cell: (entry) => (entry.linesCount === null ? "" : String(entry.linesCount)),
  },
  {
    id: "reversal",
    header: "Correction",
    cell: (entry) => (entry.reversalOfId === null ? "" : <Badge tone="warning">Contre-passation</Badge>),
  },
];

export function EntryTable({ entries }: { entries: readonly EntrySummary[] }) {
  return <DataTable caption="Écritures du grand livre" columns={COLUMNS} rows={entries} getRowId={(entry) => entry.id} />;
}
