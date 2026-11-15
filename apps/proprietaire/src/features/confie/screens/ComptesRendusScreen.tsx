"use client";

import { Alert, Badge, Button, StatCard } from "@eguardimmo/ui";
import Link from "next/link";
import { formatDate } from "../data/dates";
import { latestReport, reportTotals, upcomingReport, yearTotals } from "../data/derive";
import { useConfie } from "../data/queries";
import type { ConfieData, Report } from "../data/schemas";
import { eurFixed } from "../data/money";
import { confieRoutes } from "../routes";
import { DataTable } from "../ui/DataTable";
import type { Column, TableRow } from "../ui/DataTable";
import { PageHeader } from "../ui/PageHeader";
import { PrimaryDownload } from "../ui/parts";
import { Caption, Section, StatGrid } from "../ui/Section";
import { QueryBoundary } from "../ui/States";

export function ComptesRendusScreen() {
  const query = useConfie();
  return <QueryBoundary query={query}>{(data) => <ComptesRendus data={data} />}</QueryBoundary>;
}

const dash = (report: Report, amount: number) => (report.status === "upcoming" ? "—" : eurFixed(amount));

function ComptesRendus({ data }: { data: ConfieData }) {
  const latest = latestReport(data);
  const next = upcomingReport(data);
  const totals = yearTotals(data.settlements);

  const columns: Column<Report>[] = [
    { id: "period", header: "Période", primary: true, cell: (report) => <>{report.label}<br /><Caption>{report.span}</Caption></> },
    { id: "available", header: "Disponible le", cell: (report) => formatDate(report.availableOn) },
    { id: "collected", header: "Encaissé", align: "end", cell: (report) => dash(report, reportTotals(report).collected) },
    { id: "fees", header: "Honoraires", align: "end", cell: (report) => dash(report, reportTotals(report).fees) },
    { id: "works", header: "Travaux", align: "end", cell: (report) => (report.status === "upcoming" || reportTotals(report).works === 0 ? "—" : eurFixed(reportTotals(report).works)) },
    { id: "reversed", header: "Net reversé", align: "end", cell: (report) => dash(report, reportTotals(report).reversed) },
    {
      id: "state",
      header: "État",
      cell: (report) =>
        report.status === "upcoming" ? <Badge>À venir</Badge> : report.status === "new" ? <Badge tone="info">Nouveau</Badge> : <Badge>Consulté</Badge>,
    },
    {
      id: "action",
      header: "Action",
      action: true,
      cell: (report) =>
        report.status === "upcoming" ? null : (
          <Button variant="link" size="sm" asChild>
            <Link href={confieRoutes.compteRendu(report.id)} aria-label={`Ouvrir le compte rendu ${report.label}`}>Ouvrir</Link>
          </Button>
        ),
    },
  ];
  const rows: TableRow<Report>[] = data.reports.map((report) => ({ key: report.id, value: report }));

  return (
    <>
      <PageHeader
        title="Comptes rendus de gestion"
        crumbs={[{ label: "Mon patrimoine" }, { label: "Comptes rendus" }]}
        subtitle={`Un compte rendu par trimestre, établi par ${data.agency.name} : loyers, honoraires, travaux et reversements.`}
        actions={latest ? <PrimaryDownload title={`Compte rendu de gestion, ${latest.label}`} label={`Télécharger le ${latest.label}`} /> : null}
      />
      {latest?.status === "new" ? (
        <Alert tone="info" title={`Compte rendu de gestion, ${latest.longLabel}`}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>Disponible depuis le {formatDate(latest.availableOn)}. Vous ne l&apos;avez pas encore consulté.</span>
            <Button variant="secondary" size="sm" asChild><Link href={confieRoutes.compteRendu(latest.id)}>Ouvrir</Link></Button>
          </span>
        </Alert>
      ) : null}
      <StatGrid columns={3}>
        <StatCard label="Dernier compte rendu" value={latest?.label ?? "—"}>
          <Caption>{latest ? `Disponible depuis le ${formatDate(latest.availableOn)}` : "Aucun compte rendu"}</Caption>
        </StatCard>
        <StatCard label="Prochain compte rendu" value={next?.label ?? "—"}>
          <Caption>{next ? `Disponible le ${formatDate(next.availableOn)}` : "Aucun à venir"}</Caption>
        </StatCard>
        <StatCard label={`Reversé en ${data.today.slice(0, 4)}`} value={eurFixed(totals.reversedPaid)}><Caption>Après honoraires et travaux</Caption></StatCard>
      </StatGrid>
      <Section title="Tous les comptes rendus">
        <DataTable caption="Tous les comptes rendus de gestion" columns={columns} rows={rows} />
      </Section>
    </>
  );
}
