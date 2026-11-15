"use client";

import { Badge, Button, StatCard } from "@eguardimmo/ui";
import { CircleCheck, CircleAlert, Wrench } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatDate, monthLabel, plural } from "../data/dates";
import { lotLabel, reportTotals } from "../data/derive";
import { useConfie, useMarkReportViewed } from "../data/queries";
import type { ConfieData, Report } from "../data/schemas";
import { eurFixed } from "../data/money";
import { confieRoutes } from "../routes";
import { DataTable } from "../ui/DataTable";
import type { Column, TableRow } from "../ui/DataTable";
import { ListRow, RowList } from "../ui/ListRow";
import { PageHeader } from "../ui/PageHeader";
import { PrimaryDownload } from "../ui/parts";
import { Caption, Section, StatGrid } from "../ui/Section";
import { EmptyLine, NotFoundState, QueryBoundary } from "../ui/States";

export function CompteRenduScreen({ id }: { id: string }) {
  const query = useConfie();
  return (
    <QueryBoundary query={query}>
      {(data) => {
        const report = data.reports.find((item) => item.id === id && item.status !== "upcoming");
        return report ? <CompteRendu data={data} report={report} /> : <NotFoundState title="Compte rendu introuvable" backHref={confieRoutes.comptesRendus} backLabel="Retour aux comptes rendus" />;
      }}
    </QueryBoundary>
  );
}

function CompteRendu({ data, report }: { data: ConfieData; report: Report }) {
  const [openedAsNew] = useState(report.status === "new");
  const markViewed = useMarkReportViewed();
  const requested = useRef(false);
  const { mutate } = markViewed;
  useEffect(() => {
    if (!openedAsNew || requested.current) return;
    requested.current = true;
    mutate(report.id);
  }, [openedAsNew, mutate, report.id]);

  const totals = reportTotals(report);
  const monthColumns: Column<Report["months"][number]>[] = [
    { id: "month", header: "Mois", primary: true, cell: (month) => monthLabel(month.month) },
    { id: "called", header: "Appelé", align: "end", cell: (month) => eurFixed(month.called) },
    { id: "collected", header: "Encaissé", align: "end", cell: (month) => eurFixed(month.collected) },
    { id: "fees", header: "Honoraires", align: "end", cell: (month) => eurFixed(month.fees) },
    { id: "works", header: "Travaux", align: "end", cell: (month) => (month.works === 0 ? "—" : eurFixed(month.works)) },
    { id: "reversed", header: "Reversé", align: "end", cell: (month) => eurFixed(month.collected - month.fees - month.works) },
    { id: "on", header: "Reversé le", cell: (month) => formatDate(month.reversedOn) },
  ];
  const monthRows: TableRow<Report["months"][number]>[] = [
    ...report.months.map((month) => ({ key: month.month, value: month })),
    { kind: "total", key: "total", label: "Trimestre", cells: { called: eurFixed(totals.called), collected: eurFixed(totals.collected), fees: eurFixed(totals.fees), works: eurFixed(totals.works), reversed: eurFixed(totals.reversed) } },
  ];
  const lotColumns: Column<Report["lots"][number]>[] = [
    { id: "lot", header: "Lot", primary: true, cell: (line) => <>{lotLabel(data, line.lotId)}<br /><Caption>{data.lots.find((lot) => lot.id === line.lotId)?.tenant.name}</Caption></> },
    { id: "collected", header: "Encaissé", align: "end", cell: (line) => eurFixed(line.collected) },
    { id: "fees", header: "Honoraires", align: "end", cell: (line) => eurFixed(line.fees) },
  ];
  const lotRows: TableRow<Report["lots"][number]>[] = [
    ...report.lots.map((line) => ({ key: line.lotId, value: line })),
    { kind: "total", key: "total", label: "Total", cells: { collected: eurFixed(totals.collected), fees: eurFixed(totals.fees) } },
  ];
  const workLots = report.works.map((work) => work.title.split(", ").at(-1) ?? "").filter(Boolean);

  return (
    <>
      <PageHeader
        title={`Compte rendu de gestion, ${report.label}`}
        crumbs={[{ label: "Comptes rendus", href: confieRoutes.comptesRendus }, { label: report.label }]}
        badges={openedAsNew ? <Badge tone="info">Nouveau</Badge> : <Badge>Consulté</Badge>}
        subtitle={`Du ${formatDate(report.startOn)} au ${formatDate(report.endOn)} · établi le ${formatDate(report.availableOn)} par ${data.agency.name}`}
        actions={
          <>
            <Button variant="secondary" asChild><Link href={confieRoutes.apercu(report.id)}>Aperçu du PDF</Link></Button>
            <PrimaryDownload title={`Compte rendu de gestion, ${report.label}`} label="Télécharger le PDF" />
          </>
        }
      />
      <StatGrid>
        <StatCard label="Loyers encaissés" value={eurFixed(totals.collected)}><Caption>Sur {eurFixed(totals.called)} appelés</Caption></StatCard>
        <StatCard label="Honoraires" value={eurFixed(totals.fees)}><Caption>{data.mandate.feeRatePercent} % TTC des loyers encaissés</Caption></StatCard>
        <StatCard label="Travaux imputés" value={eurFixed(totals.works)}>
          <Caption>{report.works.length === 0 ? "Aucune intervention" : `${plural(report.works.length, "intervention")}, ${workLots.join(", ")}`}</Caption>
        </StatCard>
        <StatCard label="Net reversé" value={eurFixed(totals.reversed)}><Caption>{plural(report.months.length, "virement")}</Caption></StatCard>
      </StatGrid>
      <Section title="Synthèse mensuelle"><DataTable caption="Synthèse mensuelle" columns={monthColumns} rows={monthRows} /></Section>
      <Section title="Par lot"><DataTable caption="Détail par lot" columns={lotColumns} rows={lotRows} /></Section>
      <Section title="Impayés">
        <RowList label="Impayés">
          {report.arrears.map((item) => (
            <ListRow key={item.title} icon={item.tone === "success" ? CircleCheck : CircleAlert} tone={item.tone} title={item.title} detail={item.detail} trailing={<Badge tone={item.tone}>{item.badge}</Badge>} />
          ))}
        </RowList>
      </Section>
      <Section title="Travaux">
        {report.works.length === 0 ? <EmptyLine>Aucun travaux imputé sur ce trimestre.</EmptyLine> : (
          <RowList label="Travaux">
            {report.works.map((work) => (
              <ListRow key={work.title} icon={Wrench} title={work.title} detail={work.detail} trailing={<b className="text-body-strong tabular-nums">{eurFixed(work.amount)}</b>} />
            ))}
          </RowList>
        )}
      </Section>
      <Section title="Observations de l'agence"><p className="text-body text-fg-muted">{report.observations}</p></Section>
    </>
  );
}
