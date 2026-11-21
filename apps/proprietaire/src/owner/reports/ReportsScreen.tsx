"use client";

import { Badge } from "@eguardimmo/ui";
import { FileChartColumn } from "lucide-react";
import Link from "next/link";
import { confieRoutes } from "@/features/confie/routes";
import { DataTable } from "@/features/confie/ui/DataTable";
import type { Column } from "@/features/confie/ui/DataTable";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Section } from "@/features/confie/ui/Section";
import { agencyAndMandant, formatOptionalDay, formatOptionalMoney, formatPeriod, labelOf } from "../format";
import { AgencyFilter } from "../shared/AgencyFilter";
import { PagedState } from "../shared/PagedState";
import { useAgencyFilter } from "../shared/useAgencyFilter";
import { PERIOD_KIND, REPORT_STATUS } from "./labels";
import type { OwnerReport } from "./model";
import { useReports } from "./queries";

export function ReportStatusBadge({ status }: { status: string }) {
  const entry = REPORT_STATUS[status];
  return <Badge tone={entry?.tone ?? "neutral"}>{entry?.label ?? labelOf({}, status)}</Badge>;
}

const columns: readonly Column<OwnerReport>[] = [
  {
    id: "numero",
    header: "Compte rendu",
    primary: true,
    cell: (report) => (
      <Link href={confieRoutes.compteRendu(report.id)} className="underline-offset-2 hover:underline">
        {report.number}
      </Link>
    ),
  },
  { id: "periode", header: "Période", cell: (report) => `${labelOf(PERIOD_KIND, report.periodKind)} ${formatPeriod(report.periodStart, report.periodEnd)}` },
  { id: "mandat", header: "Mandat", cell: (report) => agencyAndMandant(report.agency.name, report.mandantName) },
  { id: "statut", header: "Statut", cell: (report) => <ReportStatusBadge status={report.status} /> },
  { id: "encaisse", header: "Encaissé", align: "end", cell: (report) => formatOptionalMoney(report.totals.collected) },
  { id: "reverse", header: "Reversé", align: "end", cell: (report) => formatOptionalMoney(report.totals.payout) },
  { id: "publie", header: "Publié le", cell: (report) => formatOptionalDay(report.publishedAt) },
];

export function ReportsScreen() {
  const filter = useAgencyFilter();
  const list = useReports(filter.agency, !filter.unknown);
  return (
    <>
      <PageHeader title="Comptes rendus de gestion" subtitle="Les comptes rendus publiés par votre agence" />
      <AgencyFilter filter={filter} />
      {filter.unknown ? null : (
        <PagedState
          list={list}
          loadingLabel="Chargement des comptes rendus"
          failureTitle="Vos comptes rendus n’ont pas pu être chargés"
          empty={{ icon: FileChartColumn, title: "Aucun compte rendu", description: "Votre agence n’a publié aucun compte rendu pour cette sélection." }}
        >
          {(reports) => (
            <Section title="Comptes rendus publiés">
              <DataTable caption="Comptes rendus de gestion publiés" columns={columns} rows={reports.map((report) => ({ key: report.id, value: report }))} />
            </Section>
          )}
        </PagedState>
      )}
    </>
  );
}
