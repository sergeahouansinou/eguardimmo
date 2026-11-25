import { Alert, EmptyState } from "@eguardimmo/ui";
import { FileText } from "lucide-react";
import Link from "next/link";
import { SectionCard } from "@/components/ui/SectionCard";
import { DataTable, SummaryLines } from "@/features/kit";
import type { Column } from "@/features/kit";
import { formatMoney } from "@/features/org/format";
import type { Money } from "@/features/org/schemas";
import { formatDate } from "@/features/shared/dates";
import { JOURNAL_LABELS } from "./labels";
import { entryHref } from "./paths";
import type { LeaseStatement, StatementLine } from "./schemas";

const amountOrBlank = (money: Money): string => (money.amount === 0 ? "" : formatMoney(money));

type Row = StatementLine & { key: string };

const COLUMNS: readonly Column<Row>[] = [
  { id: "date", header: "Date", cell: (line) => formatDate(line.date) },
  {
    id: "reference",
    header: "Pièce",
    role: "title",
    cell: (line) => (
      <Link href={entryHref(line.entryId)} className="inline-flex min-h-11 items-center text-action-on-subtle underline underline-offset-2">
        {line.reference}
        <span className="sr-only">, {line.label}</span>
      </Link>
    ),
  },
  { id: "journal", header: "Journal", cell: (line) => JOURNAL_LABELS[line.journal] },
  { id: "label", header: "Libellé", cell: (line) => line.label },
  { id: "debit", header: "Débit", numeric: true, cell: (line) => amountOrBlank(line.debit) },
  { id: "credit", header: "Crédit", numeric: true, cell: (line) => amountOrBlank(line.credit) },
  { id: "balance", header: "Solde", numeric: true, cell: (line) => formatMoney(line.balance, { signed: true }) },
];

function closingLabel(statement: LeaseStatement): string {
  if (statement.closing.amount > 0) return "Reste dû par le locataire";
  if (statement.closing.amount < 0) return "Trop-perçu du locataire";
  return "Compte soldé";
}

export function StatementResult({ statement }: { statement: LeaseStatement }) {
  const debit = statement.lines.reduce((sum, line) => sum + line.debit.amount, 0);
  const credit = statement.lines.reduce((sum, line) => sum + line.credit.amount, 0);
  const currency = statement.closing.currency;
  const rows = statement.lines.map((line, index): Row => ({ ...line, key: `${String(index)}-${line.entryId}` }));
  return (
    <SectionCard title={`Relevé du ${formatDate(statement.from)} au ${formatDate(statement.to)}`}>
      <div className="flex flex-col gap-3 p-4">
        <SummaryLines
          lines={[
            { label: "Solde d’ouverture", value: formatMoney(statement.opening, { signed: true }) },
            { label: "Total des débits (appels)", value: formatMoney({ amount: debit, currency }) },
            { label: "Total des crédits (règlements)", value: formatMoney({ amount: credit, currency }) },
          ]}
          total={{ label: "Solde de clôture", value: formatMoney(statement.closing, { signed: true }) }}
        />
        <p className="text-body font-medium text-fg">{closingLabel(statement)}</p>
        {statement.lines.length === 0 ? (
          <EmptyState icon={FileText} title="Aucun mouvement sur la période" description="Ce bail n’a ni appel ni règlement entre ces deux dates." />
        ) : (
          <DataTable caption="Mouvements du compte locataire" columns={COLUMNS} rows={rows} getRowId={(line) => line.key} />
        )}
        <Alert tone="info">Un solde positif est dû par le locataire ; un solde négatif est un trop-perçu.</Alert>
      </div>
    </SectionCard>
  );
}
