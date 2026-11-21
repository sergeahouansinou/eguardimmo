import { Badge, EmptyState, StatCard } from "@eguardimmo/ui";
import { ScrollText } from "lucide-react";
import { DataTable } from "./DataTable";
import type { Column } from "./DataTable";
import { Caption, Section, StatGrid } from "./Section";

export interface StatementRowView {
  key: string;
  date: string;
  label: string;
  reference: string;
  source: string;
  reversal: boolean;
  debit: string | null;
  credit: string | null;
  balance: string;
}

export interface StatementViewProps {
  openingLabel: string;
  closingLabel: string;
  opening: string;
  closing: string;
  caption: string;
  rows: readonly StatementRowView[];
}

const columns: readonly Column<StatementRowView>[] = [
  { id: "date", header: "Date", primary: true, cell: (row) => row.date },
  {
    id: "label",
    header: "Libellé",
    cell: (row) => (
      <>
        {row.label}
        <br />
        <Caption>{`${row.source} · ${row.reference}`}</Caption>
        {row.reversal ? (
          <>
            {" "}
            <Badge tone="warning">Annulation</Badge>
          </>
        ) : null}
      </>
    ),
  },
  { id: "debit", header: "Débit", align: "end", cell: (row) => row.debit ?? "—" },
  { id: "credit", header: "Crédit", align: "end", cell: (row) => row.credit ?? "—" },
  { id: "balance", header: "Solde", align: "end", cell: (row) => row.balance },
];

export function StatementView({ openingLabel, closingLabel, opening, closing, caption, rows }: StatementViewProps) {
  return (
    <>
      <StatGrid columns={3}>
        <StatCard label={openingLabel} value={opening} />
        <StatCard label={closingLabel} value={closing} />
        <StatCard label="Mouvements" value={String(rows.length)}>
          <Caption>sur la période</Caption>
        </StatCard>
      </StatGrid>
      <Section title="Mouvements du compte">
        {rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="Aucun mouvement sur cette période" description="Le solde est inchangé entre le début et la fin de la période choisie." />
        ) : (
          <DataTable caption={caption} columns={columns} rows={rows.map((row) => ({ key: row.key, value: row }))} />
        )}
      </Section>
    </>
  );
}
