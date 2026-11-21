"use client";

import { Wallet } from "lucide-react";
import { DataTable } from "@/features/confie/ui/DataTable";
import type { Column, TableRow } from "@/features/confie/ui/DataTable";
import { Caption, Section } from "@/features/confie/ui/Section";
import { EmptyState } from "@eguardimmo/ui";
import { NOT_AVAILABLE, ROLE_LABELS, agencyLabel, formatMoney } from "../format";
import type { OwnerRole } from "../model";
import { FailureNotice, Loading } from "../screens/FailureNotice";
import type { RentAmounts, RentMandant, RentUnitRow } from "./model";
import { useRentMonth } from "./queries";

const columns: readonly Column<RentUnitRow>[] = [
  { id: "lot", header: "Lot", primary: true, cell: (row) => `${row.reference} · ${row.propertyName}` },
  { id: "called", header: "Loyer appelé", align: "end", cell: (row) => formatMoney(row.amounts.called) },
  { id: "collected", header: "Encaissé", align: "end", cell: (row) => formatMoney(row.amounts.collected) },
  { id: "fees", header: "Honoraires", align: "end", cell: (row) => formatMoney(row.amounts.fees) },
  { id: "works", header: "Travaux", align: "end", cell: (row) => formatMoney(row.amounts.works) },
  { id: "net", header: "Net", align: "end", cell: (row) => formatMoney(row.amounts.net) },
  { id: "arrears", header: "Impayé", align: "end", cell: (row) => (row.arrears === null ? NOT_AVAILABLE : formatMoney(row.arrears)) },
];

function totalCells(amounts: RentAmounts): Record<string, string> {
  return {
    called: formatMoney(amounts.called),
    collected: formatMoney(amounts.collected),
    fees: formatMoney(amounts.fees),
    works: formatMoney(amounts.works),
    net: formatMoney(amounts.net),
  };
}

function rowsOf(mandant: RentMandant, key: string): TableRow<RentUnitRow>[] {
  return [
    ...mandant.units.map((unit): TableRow<RentUnitRow> => ({ key: `${key}-${unit.id}`, value: unit })),
    { kind: "total", key: `${key}-others`, label: "Autres écritures du mandat", cells: totalCells(mandant.others) },
    { kind: "total", key: `${key}-totals`, label: "Total de ce mandat", cells: totalCells(mandant.totals) },
  ];
}

function roleLabel(role: string): string {
  return role in ROLE_LABELS ? ROLE_LABELS[role as OwnerRole] : NOT_AVAILABLE;
}

export function RentMonthSections({ month, agency, enabled }: { month: string; agency: string | null; enabled: boolean }) {
  const query = useRentMonth(month, agency, enabled);
  if (query.data === undefined) {
    return query.isError ? <FailureNotice title="Les loyers du mois n’ont pas pu être chargés" error={query.error} onRetry={() => void query.refetch()} /> : <Loading label="Chargement des loyers du mois" />;
  }
  if (query.data.mandants.length === 0) {
    return <EmptyState icon={Wallet} title="Aucun loyer pour ce mois" description="Aucun mandat ne couvre vos lots sur cette période pour cette sélection." />;
  }
  return (
    <>
      {query.data.mandants.map((mandant) => {
        const key = `${mandant.agency.id}-${mandant.mandantName ?? "mandant"}`;
        return (
          <Section key={key} title={`${mandant.mandantName ?? NOT_AVAILABLE} · ${agencyLabel(mandant.agency.name)}`} aside={<Caption>{`${roleLabel(mandant.role)} · montants en ${mandant.currency}`}</Caption>}>
            <DataTable caption={`Loyers de ${mandant.mandantName ?? "votre mandat"} chez ${agencyLabel(mandant.agency.name)}`} columns={columns} rows={rowsOf(mandant, key)} />
          </Section>
        );
      })}
      <Caption>Chaque mandat est présenté dans sa devise : aucun total n’additionne deux agences ni deux devises.</Caption>
    </>
  );
}
