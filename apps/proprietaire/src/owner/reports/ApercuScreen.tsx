"use client";

import { Button, Icon } from "@eguardimmo/ui";
import { Download, Printer } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { confieRoutes } from "@/features/confie/routes";
import { DataList } from "@/features/confie/ui/DataList";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Section } from "@/features/confie/ui/Section";
import { agencyAndMandant, formatOptionalDay, formatPeriod } from "../format";
import { FailureNotice, Loading } from "../screens/FailureNotice";
import { downloadName, saveBlob } from "../shared/download";
import type { OwnerReportDetail } from "./model";
import { useReportPdf } from "./pdfPreview";
import { useReport } from "./queries";
import { ReportStatusBadge } from "./ReportsScreen";

function Viewer({ report }: { report: OwnerReportDetail }) {
  const { query, blob, url } = useReportPdf(report.id);
  const frame = useRef<HTMLIFrameElement>(null);
  const name = downloadName(`compte-rendu-${report.number}`, "application/pdf");
  return (
    <>
      <PageHeader
        title={`Compte rendu ${report.number}`}
        subtitle="Aperçu du document avant téléchargement."
        badges={<ReportStatusBadge status={report.status} />}
        crumbs={[{ label: "Comptes rendus", href: confieRoutes.comptesRendus }, { label: report.number, href: confieRoutes.compteRendu(report.id) }, { label: "Aperçu PDF" }]}
        actions={
          <>
            <Button
              variant="secondary"
              disabled={url === null}
              onClick={() => {
                frame.current?.contentWindow?.print();
              }}
            >
              <Icon icon={Printer} />
              Imprimer
            </Button>
            <Button
              disabled={blob === undefined}
              onClick={() => {
                if (blob !== undefined) saveBlob(blob, name);
              }}
            >
              <Icon icon={Download} />
              Télécharger le PDF
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
        <section aria-label="Aperçu du document" className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-muted">
          {query.isError ? (
            <div className="p-3">
              <FailureNotice title="Le PDF n’a pas pu être chargé" error={query.error} onRetry={() => void query.refetch()} />
            </div>
          ) : url === null ? (
            <div className="p-3">
              <Loading label="Chargement du PDF" rows={6} />
            </div>
          ) : (
            <iframe ref={frame} src={url} title={`Compte rendu de gestion ${report.number}`} className="h-[70vh] min-h-96 w-full border-0 bg-surface" />
          )}
        </section>
        <div className="flex flex-col gap-3">
          <Section title="Document">
            <DataList
              width="sm"
              items={[
                { label: "Numéro", value: report.number },
                { label: "Période", value: formatPeriod(report.periodStart, report.periodEnd) },
                { label: "Mandat", value: agencyAndMandant(report.agency.name, report.mandantName) },
                { label: "Publié le", value: formatOptionalDay(report.publishedAt) },
              ]}
            />
          </Section>
          <Button variant="secondary" asChild>
            <Link href={confieRoutes.compteRendu(report.id)}>Voir le détail du compte rendu</Link>
          </Button>
        </div>
      </div>
    </>
  );
}

export function ApercuScreen({ id }: { id: string }) {
  const query = useReport(id);
  if (query.data !== undefined) return <Viewer report={query.data} />;
  if (!query.isError) return <Loading label="Chargement du compte rendu" />;
  return (
    <>
      <PageHeader title="Compte rendu" crumbs={[{ label: "Comptes rendus", href: confieRoutes.comptesRendus }, { label: "Aperçu PDF" }]} />
      <FailureNotice title="Ce compte rendu n’a pas pu être chargé" error={query.error} onRetry={() => void query.refetch()} />
      <div>
        <Button variant="secondary" asChild>
          <Link href={confieRoutes.comptesRendus}>Retour aux comptes rendus</Link>
        </Button>
      </div>
    </>
  );
}
