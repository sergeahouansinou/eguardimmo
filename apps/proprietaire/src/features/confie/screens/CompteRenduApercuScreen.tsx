"use client";

import { Button, IconButton, Icon } from "@eguardimmo/ui";
import { ChevronLeft, ChevronRight, Printer, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";
import { formatDate } from "../data/dates";
import { useConfie } from "../data/queries";
import type { ConfieData, Report } from "../data/schemas";
import { confieRoutes } from "../routes";
import { DataList } from "../ui/DataList";
import { PageHeader } from "../ui/PageHeader";
import { PrimaryDownload } from "../ui/parts";
import { Section } from "../ui/Section";
import { NotFoundState, QueryBoundary } from "../ui/States";
import { PRINT_STYLE, ReportDocument } from "./ReportDocument";

const ZOOMS = [75, 100, 125] as const;

export function CompteRenduApercuScreen({ id }: { id: string }) {
  const query = useConfie();
  return (
    <QueryBoundary query={query}>
      {(data) => {
        const report = data.reports.find((item) => item.id === id && item.status !== "upcoming");
        return report ? <Apercu data={data} report={report} /> : <NotFoundState title="Compte rendu introuvable" backHref={confieRoutes.comptesRendus} backLabel="Retour aux comptes rendus" />;
      }}
    </QueryBoundary>
  );
}

function Apercu({ data, report }: { data: ConfieData; report: Report }) {
  const [page, setPage] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(1);
  const zoom = ZOOMS[zoomIndex] ?? 100;

  return (
    <>
      <style>{PRINT_STYLE}</style>
      <PageHeader
        title={`Compte rendu ${report.label}`}
        crumbs={[{ label: "Comptes rendus", href: confieRoutes.comptesRendus }, { label: report.label, href: confieRoutes.compteRendu(report.id) }, { label: "Aperçu PDF" }]}
        subtitle="Aperçu du document avant téléchargement."
        actions={
          <>
            <Button variant="secondary" onClick={() => { window.print(); }}><Icon icon={Printer} />Imprimer</Button>
            <PrimaryDownload title={`Compte rendu de gestion, ${report.label}`} label="Télécharger le PDF" />
          </>
        }
      />
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
        <section aria-label="Aperçu du document" className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-muted">
          <div className="flex flex-wrap items-center gap-1 border-b border-line bg-surface px-2 py-1.5">
            <IconButton label="Page précédente" icon={ChevronLeft} disabled={page <= 1} onClick={() => { setPage(page - 1); }} />
            <span className="px-1 text-caption text-fg-muted" aria-live="polite">Page {page} / {report.pages}</span>
            <IconButton label="Page suivante" icon={ChevronRight} disabled={page >= report.pages} onClick={() => { setPage(page + 1); }} />
            <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
            <IconButton label="Zoom arrière" icon={ZoomOut} disabled={zoomIndex <= 0} onClick={() => { setZoomIndex(zoomIndex - 1); }} />
            <span className="px-1 text-caption text-fg-muted">{zoom} %</span>
            <IconButton label="Zoom avant" icon={ZoomIn} disabled={zoomIndex >= ZOOMS.length - 1} onClick={() => { setZoomIndex(zoomIndex + 1); }} />
          </div>
          <div className="overflow-auto p-3">
            <div className="mx-auto w-fit">
              <ReportDocument data={data} report={report} page={page} zoom={zoom} />
            </div>
          </div>
        </section>
        <div className="flex flex-col gap-3">
          <Section title="Document">
            <DataList width="sm" items={[{ label: "Période", value: report.label }, { label: "Mandat", value: data.mandate.reference }, { label: "Établi le", value: formatDate(report.availableOn) }]} />
          </Section>
          <Section title="Contenu">
            <DataList width="sm" items={[{ label: "Pages", value: report.pages }, { label: "Lots", value: report.lots.length }, { label: "Virements", value: report.months.length }]} />
          </Section>
        </div>
      </div>
    </>
  );
}
