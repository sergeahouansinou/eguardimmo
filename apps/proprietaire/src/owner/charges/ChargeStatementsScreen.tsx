"use client";

import { Calculator } from "lucide-react";
import Link from "next/link";
import { confieRoutes } from "@/features/confie/routes";
import { DataTable } from "@/features/confie/ui/DataTable";
import type { Column } from "@/features/confie/ui/DataTable";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Caption, Section } from "@/features/confie/ui/Section";
import { agencyLabel, formatMoney } from "../format";
import { AgencyFilter } from "../shared/AgencyFilter";
import { PagedState } from "../shared/PagedState";
import { useAgencyFilter } from "../shared/useAgencyFilter";
import type { OwnerStatement } from "./model";
import { formatStatementPeriod } from "./period";
import { useStatements } from "./queries";
import { BalanceText, StatementStatusBadge, issuedDay, statementTitle, tenantsLabel, unitLabel } from "./StatementParts";

const columns: readonly Column<OwnerStatement>[] = [
  {
    id: "numero",
    header: "Décompte",
    primary: true,
    cell: (statement) => (
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <Link href={confieRoutes.charge(statement.id)} className="underline-offset-2 hover:underline">
            {statementTitle(statement)}
          </Link>
          <StatementStatusBadge status={statement.status} />
        </span>
        <Caption>{agencyLabel(statement.agencyName)}</Caption>
        {statement.issuedAt === null ? null : <Caption>{`Émis le ${issuedDay(statement)}`}</Caption>}
      </span>
    ),
  },
  { id: "lot", header: "Bien", cell: unitLabel },
  { id: "periode", header: "Période", cell: (statement) => formatStatementPeriod(statement.period) },
  { id: "locataires", header: "Locataire", cell: (statement) => tenantsLabel(statement.tenantNames) },
  { id: "part", header: "Charges réelles", align: "end", cell: (statement) => formatMoney(statement.shareTotal) },
  { id: "provisions", header: "Provisions appelées", align: "end", cell: (statement) => formatMoney(statement.provisionsCalled) },
  { id: "solde", header: "Solde du locataire", align: "end", cell: (statement) => <BalanceText balance={statement.balance} /> },
];

export function ChargeStatementsScreen() {
  const filter = useAgencyFilter();
  const list = useStatements(filter.agency, !filter.unknown);
  return (
    <>
      <PageHeader title="Décomptes de charges" subtitle="La régularisation annuelle des charges de vos locataires, en consultation" />
      <AgencyFilter filter={filter} />
      {filter.unknown ? null : (
        <PagedState
          list={list}
          loadingLabel="Chargement de vos décomptes de charges"
          failureTitle="Vos décomptes de charges n’ont pas pu être chargés"
          empty={{ icon: Calculator, title: "Aucun décompte de charges", description: "Votre agence n’a émis aucun décompte de charges sur vos lots pour cette sélection." }}
        >
          {(statements) => (
            <Section title="Décomptes émis">
              <div className="relative min-w-0 overflow-x-auto">
                <DataTable caption="Décomptes de charges de vos lots confiés" columns={columns} rows={statements.map((statement) => ({ key: statement.id, value: statement }))} />
              </div>
            </Section>
          )}
        </PagedState>
      )}
    </>
  );
}
