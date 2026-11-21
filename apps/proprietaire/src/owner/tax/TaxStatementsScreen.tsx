"use client";

import { Alert, Badge } from "@eguardimmo/ui";
import { FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { confieRoutes } from "@/features/confie/routes";
import { DataTable } from "@/features/confie/ui/DataTable";
import type { Column } from "@/features/confie/ui/DataTable";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Section } from "@/features/confie/ui/Section";
import { agencyLabel, formatOptionalDay, formatOptionalMoney } from "../format";
import { AgencyFilter } from "../shared/AgencyFilter";
import { PagedState } from "../shared/PagedState";
import { useAgencyFilter } from "../shared/useAgencyFilter";
import { STATEMENT_STATUS, VALIDATION_NOTE } from "./labels";
import type { OwnerTaxStatement } from "./model";
import { useTaxStatements } from "./queries";

const total = (statement: OwnerTaxStatement, code: string) => {
  const line = statement.totals.find((entry) => entry.code === code);
  return formatOptionalMoney(line?.amount ?? null);
};

export function TaxStatusBadge({ status }: { status: OwnerTaxStatement["status"] }) {
  const entry = STATEMENT_STATUS[status];
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

const columns: readonly Column<OwnerTaxStatement>[] = [
  {
    id: "annee",
    header: "Revenus de l’année",
    primary: true,
    cell: (statement) => (
      <Link href={confieRoutes.fiscaliteReleve(statement.id)} className="underline-offset-2 hover:underline">
        {String(statement.incomeYear)}
      </Link>
    ),
  },
  { id: "agence", header: "Agence", cell: (statement) => agencyLabel(statement.agency.name) },
  { id: "statut", header: "Statut", cell: (statement) => <TaxStatusBadge status={statement.status} /> },
  { id: "recettes", header: "Total des recettes (ligne 215)", align: "end", cell: (statement) => total(statement, "215") },
  { id: "net", header: "Revenu foncier (ligne 263)", align: "end", cell: (statement) => total(statement, "263") },
  { id: "publie", header: "Publié le", cell: (statement) => formatOptionalDay(statement.publishedAt) },
];

export function TaxStatementsScreen() {
  const filter = useAgencyFilter();
  const list = useTaxStatements(filter.agency, !filter.unknown);
  return (
    <>
      <PageHeader title="Fiscalité, relevés de revenus fonciers" subtitle="Les relevés publiés par votre agence pour vous aider à préparer votre déclaration" />
      <Alert tone="info" title="Aide à la déclaration">
        {VALIDATION_NOTE}
      </Alert>
      <AgencyFilter filter={filter} />
      {filter.unknown ? null : (
        <PagedState
          list={list}
          loadingLabel="Chargement des relevés fiscaux"
          failureTitle="Vos relevés fiscaux n’ont pas pu être chargés"
          empty={{ icon: FileSpreadsheet, title: "Aucun relevé fiscal", description: "Votre agence n’a publié aucun relevé fiscal pour cette sélection." }}
        >
          {(statements) => (
            <Section title="Relevés publiés">
              <DataTable caption="Relevés fiscaux publiés" columns={columns} rows={statements.map((statement) => ({ key: statement.id, value: statement }))} />
            </Section>
          )}
        </PagedState>
      )}
    </>
  );
}
