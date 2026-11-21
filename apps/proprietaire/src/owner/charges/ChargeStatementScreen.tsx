"use client";

import { Button } from "@eguardimmo/ui";
import Link from "next/link";
import { confieRoutes } from "@/features/confie/routes";
import { DataList } from "@/features/confie/ui/DataList";
import { DataTable } from "@/features/confie/ui/DataTable";
import type { Column } from "@/features/confie/ui/DataTable";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Section } from "@/features/confie/ui/Section";
import { agencyLabel, formatMoney } from "../format";
import { FailureNotice, Loading } from "../screens/FailureNotice";
import type { OwnerStatementDetail, StatementLine } from "./model";
import { formatStatementPeriod } from "./period";
import { useStatement } from "./queries";
import { BalanceText, StatementStatusBadge, issuedDay, statementTitle, tenantsLabel, unitLabel } from "./StatementParts";

const CRUMB = { label: "Décomptes de charges", href: confieRoutes.charges };

const lineColumns: readonly Column<StatementLine>[] = [
  { id: "poste", header: "Poste de charges", primary: true, cell: (line) => line.label },
  { id: "repartition", header: "Répartition", cell: (line) => line.splitLabel },
  { id: "montant", header: "Montant du poste", align: "end", cell: (line) => formatMoney(line.itemAmount) },
  { id: "jours", header: "Jours", align: "end", cell: (line) => String(line.days) },
  { id: "part", header: "Part du locataire", align: "end", cell: (line) => formatMoney(line.share) },
];

function Content({ statement }: { statement: OwnerStatementDetail }) {
  const title = statementTitle(statement);
  return (
    <>
      <PageHeader title={title} subtitle={agencyLabel(statement.agencyName)} badges={<StatementStatusBadge status={statement.status} />} crumbs={[CRUMB, { label: title }]} />
      <Section title="Décompte">
        <DataList
          width="lg"
          items={[
            { label: "Bien", value: unitLabel(statement) },
            { label: "Locataire", value: tenantsLabel(statement.tenantNames) },
            { label: "Période", value: formatStatementPeriod(statement.period) },
            { label: "Émis le", value: issuedDay(statement) },
          ]}
        />
      </Section>
      <Section title="Postes de charges">
        <DataTable caption="Postes de charges du décompte" columns={lineColumns} rows={statement.lines.map((line, index) => ({ key: `${String(index)}-${line.label}`, value: line }))} />
      </Section>
      <Section title="Solde">
        <DataList
          width="lg"
          items={[
            { label: "Charges réelles", value: formatMoney(statement.shareTotal) },
            { label: "Provisions appelées", value: formatMoney(statement.provisionsCalled) },
            { label: "Solde du locataire", value: <BalanceText balance={statement.balance} /> },
          ]}
        />
      </Section>
    </>
  );
}

export function ChargeStatementScreen({ id }: { id: string }) {
  const query = useStatement(id);
  if (query.data !== undefined) return <Content statement={query.data} />;
  if (!query.isError) return <Loading label="Chargement du décompte de charges" />;
  return (
    <>
      <PageHeader title="Décompte de charges" crumbs={[CRUMB, { label: "Décompte" }]} />
      <FailureNotice title="Ce décompte de charges n’a pas pu être chargé" error={query.error} onRetry={() => void query.refetch()} />
      <div>
        <Button variant="secondary" asChild>
          <Link href={confieRoutes.charges}>Retour aux décomptes de charges</Link>
        </Button>
      </div>
    </>
  );
}
