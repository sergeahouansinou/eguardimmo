"use client";

import { Alert, Button } from "@eguardimmo/ui";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { confieRoutes } from "@/features/confie/routes";
import { DataList } from "@/features/confie/ui/DataList";
import { DataTable } from "@/features/confie/ui/DataTable";
import type { Column } from "@/features/confie/ui/DataTable";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Section } from "@/features/confie/ui/Section";
import { NOT_AVAILABLE, agencyAndMandant, formatDay, formatMoney, formatOptionalDay, formatOptionalMoney, formatPeriod, labelOf } from "../format";
import { FailureNotice, Loading } from "../screens/FailureNotice";
import { DownloadAction } from "../shared/DownloadAction";
import { useWriteAccess } from "../shared/useWriteAccess";
import { downloadName } from "../shared/download";
import { LINE_DIRECTION, LINE_KIND, SECTION_LABELS } from "./labels";
import type { OwnerReportDetail, ReportLine, ReportUnit } from "./model";
import { useMarkReportRead, useReport } from "./queries";
import { ReportStatusBadge } from "./ReportsScreen";
import { reportPdfPath } from "./requests";

function lineColumns(units: readonly ReportUnit[]): readonly Column<ReportLine>[] {
  const reference = (unitId: string | null) => units.find((unit) => unit.id === unitId)?.reference ?? NOT_AVAILABLE;
  return [
    { id: "date", header: "Date", primary: true, cell: (line) => formatDay(line.date) },
    { id: "nature", header: "Nature", cell: (line) => labelOf(LINE_KIND, line.kind) },
    { id: "lot", header: "Lot", cell: (line) => (line.unitId === null ? NOT_AVAILABLE : reference(line.unitId)) },
    { id: "libelle", header: "Libellé", cell: (line) => (line.interventionReference === null ? line.label : `${line.label} (${line.interventionReference})`) },
    { id: "sens", header: "Sens", cell: (line) => labelOf(LINE_DIRECTION, line.direction) },
    { id: "montant", header: "Montant", align: "end", cell: (line) => formatMoney(line.amount) },
  ];
}

const unitColumns: readonly Column<ReportUnit>[] = [
  { id: "lot", header: "Lot", primary: true, cell: (unit) => `${unit.reference ?? NOT_AVAILABLE} · ${unit.propertyName ?? NOT_AVAILABLE}` },
  { id: "bail", header: "Bail", cell: (unit) => unit.leaseReference ?? NOT_AVAILABLE },
  { id: "locataires", header: "Locataires", cell: (unit) => (unit.tenants.length === 0 ? NOT_AVAILABLE : unit.tenants.join(", ")) },
];

function useMarkOnOpen(report: OwnerReportDetail): void {
  const { canWrite } = useWriteAccess(report.agency.id);
  const { mutate } = useMarkReportRead();
  const sent = useRef<string | null>(null);
  const pending = report.firstReadAt === null;
  useEffect(() => {
    if (!canWrite || !pending || sent.current === report.id) return;
    sent.current = report.id;
    mutate(report.id);
  }, [canWrite, pending, report.id, mutate]);
}

function Content({ report }: { report: OwnerReportDetail }) {
  useMarkOnOpen(report);
  const { totals } = report;
  return (
    <>
      <PageHeader
        title={`Compte rendu ${report.number}`}
        subtitle={`${agencyAndMandant(report.agency.name, report.mandantName)} · ${formatPeriod(report.periodStart, report.periodEnd)}`}
        badges={<ReportStatusBadge status={report.status} />}
        crumbs={[{ label: "Comptes rendus", href: confieRoutes.comptesRendus }, { label: report.number }]}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href={confieRoutes.apercu(report.id)}>Aperçu du PDF</Link>
            </Button>
            <DownloadAction path={reportPdfPath(report.id)} filename={downloadName(`compte-rendu-${report.number}`, "application/pdf")} format="pdf" label="Télécharger le PDF" variant="primary" />
          </>
        }
      />
      {report.status === "superseded" ? (
        <Alert tone="warning" title="Compte rendu remplacé">
          Votre agence a publié une version plus récente de ce compte rendu. Les chiffres ci-dessous sont ceux de cette version.
        </Alert>
      ) : null}
      {report.supersedesId === null ? null : (
        <Button variant="link" size="sm" asChild className="self-start">
          <Link href={confieRoutes.compteRendu(report.supersedesId)}>Voir la version remplacée</Link>
        </Button>
      )}
      <Section title="Synthèse">
        <DataList
          width="lg"
          items={[
            { label: "Solde d’ouverture", value: formatOptionalMoney(totals.openingBalance) },
            { label: "Loyers encaissés", value: formatOptionalMoney(totals.collected) },
            { label: "Honoraires", value: formatOptionalMoney(totals.fees) },
            { label: "Travaux", value: formatOptionalMoney(totals.works) },
            { label: "Reversement", value: formatOptionalMoney(totals.payout) },
            { label: "Ajustements", value: formatOptionalMoney(totals.adjustments) },
            { label: "Solde de clôture", value: formatOptionalMoney(totals.closingBalance) },
            { label: "Rubriques", value: report.sections.map((section) => labelOf(SECTION_LABELS, section)).join(", ") || NOT_AVAILABLE },
            { label: "Publié le", value: formatOptionalDay(report.publishedAt) },
          ]}
        />
      </Section>
      <Section title="Lots concernés">
        <DataTable caption="Lots concernés par le compte rendu" columns={unitColumns} rows={report.units.map((unit) => ({ key: unit.id, value: unit }))} />
      </Section>
      <Section title="Détail des écritures">
        <DataTable caption="Écritures du compte rendu" columns={lineColumns(report.units)} rows={report.lines.map((line) => ({ key: String(line.position), value: line }))} />
      </Section>
      {report.receipts.length === 0 ? null : (
        <Section title="Quittances émises">
          <ul className="flex flex-col gap-1 text-body">
            {report.receipts.map((receipt) => (
              <li key={receipt.number}>{receipt.issuedOn === null ? receipt.number : `${receipt.number} · émise le ${formatDay(receipt.issuedOn)}`}</li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

export function ReportScreen({ id }: { id: string }) {
  const query = useReport(id);
  if (query.data !== undefined) return <Content report={query.data} />;
  if (!query.isError) return <Loading label="Chargement du compte rendu" />;
  return (
    <>
      <PageHeader title="Compte rendu" crumbs={[{ label: "Comptes rendus", href: confieRoutes.comptesRendus }, { label: "Compte rendu" }]} />
      <FailureNotice title="Ce compte rendu n’a pas pu être chargé" error={query.error} onRetry={() => void query.refetch()} />
      <div>
        <Button variant="secondary" asChild>
          <Link href={confieRoutes.comptesRendus}>Retour aux comptes rendus</Link>
        </Button>
      </div>
    </>
  );
}
