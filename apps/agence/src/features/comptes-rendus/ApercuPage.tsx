"use client";

import { Badge, Button, Card, CardHeader, CardTitle, Icon, IconButton } from "@eguardimmo/ui";
import { ChevronLeft, ChevronRight, Minus, Plus, Printer, Download, Send } from "lucide-react";
import { useState } from "react";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { QueryState } from "@/components/ui/QueryState";
import { ActionDialog, DetailList, LinkButton, PageFrame, SummaryLines, SwitchRow, useNotify } from "@/features/kit";
import { PrintStyles } from "@/features/kit/PrintArea";
import { useInterventions } from "@/features/interventions/queries";
import { STATUS_LABELS } from "@/features/interventions/labels";
import { formatDate } from "@/features/shared/dates";
import { messageOf } from "@/features/shared/errors";
import { formatMoneyExact } from "@/features/shared/money";
import { STATE_LABELS, STATE_TONES } from "./labels";
import { pageCount } from "./pages";
import type { Work } from "./pages";
import { useGenerate, usePublish, useReport, useSetPdfOptions } from "./queries";
import { ReportPaper } from "./ReportPaper";
import type { PdfOptions, ReportDetail } from "./schemas";

const ZOOM_STEP = 25;
const ZOOM_MIN = 50;
const ZOOM_MAX = 150;

export function ApercuPage({ id }: { id: string }) {
  const report = useReport(id);
  return (
    <QueryState query={report} label="Le compte rendu">
      {(detail) =>
        detail === null ? (
          <NotFoundState title="Compte rendu introuvable" description="Ce compte rendu n'existe pas ou n'a pas encore de chiffres." backHref="/comptes-rendus" backLabel="Retour aux comptes rendus" />
        ) : (
          <Apercu detail={detail} />
        )
      }
    </QueryState>
  );
}

function Apercu({ detail }: { detail: ReportDetail }) {
  const notify = useNotify();
  const publish = usePublish();
  const generate = useGenerate();
  const setOptions = useSetPdfOptions();
  const interventions = useInterventions();
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { statement } = detail;
  const works: Work[] = (interventions.data ?? [])
    .filter((item) => item.mandantId === statement.mandantId && item.reportedOn <= detail.to && (item.completedOn ?? "9999-12-31") >= detail.from)
    .map((item) => ({ id: item.id, subject: item.subject, propertyLabel: item.propertyLabel, statusLabel: STATUS_LABELS[item.status] }));
  const total = pageCount(detail, works);
  const current = Math.min(page, total);
  const editable = detail.state === "brouillon" || detail.state === "genere";
  const mandantName = statement.mandantName;

  const changeOption = (key: keyof PdfOptions, value: boolean) => {
    setOptions.mutate(
      { id: detail.id, ...detail.options, [key]: value },
      {
        onError: (cause) => {
          notify.error("Option non enregistrée", messageOf(cause));
        },
      },
    );
  };

  const confirmPublish = () => {
    setError(null);
    publish.mutate(detail.id, {
      onSuccess: () => {
        notify.success("Compte rendu publié", `${mandantName} peut le consulter dans son espace propriétaire.`);
        setConfirming(false);
      },
      onError: (cause) => {
        setError(messageOf(cause));
      },
    });
  };

  const generateNow = () => {
    generate.mutate(
      {
        kind: detail.kind,
        from: detail.from,
        to: detail.to,
        mandantIds: [statement.mandantId],
        content: detail.content,
        publication: detail.publication,
        notify: detail.notify,
        draft: false,
      },
      {
        onSuccess: () => {
          notify.success("Compte rendu généré", `${mandantName}, ${detail.periodLabel.toLowerCase()}.`);
        },
        onError: (cause) => {
          notify.error("Génération impossible", messageOf(cause));
        },
      },
    );
  };

  const publication =
    detail.state === "publie" && detail.publishedOn
      ? `Publié le ${formatDate(detail.publishedOn)}`
      : detail.publication === "planifiee"
        ? formatDate(statement.transferDate)
        : "Dès la validation";

  return (
    <PageFrame
      crumbs={[{ label: "Comptes rendus", href: "/comptes-rendus" }, { label: mandantName }, { label: "Aperçu" }]}
      title={`Compte rendu, ${detail.periodLabel.toLowerCase()}`}
      badges={<Badge tone={STATE_TONES[detail.state]}>{STATE_LABELS[detail.state]}</Badge>}
      description={`${mandantName}, ${statement.mandantKind} · ${detail.state === "publie" ? "publié dans son espace propriétaire." : "aperçu avant publication dans son espace propriétaire."}`}
      actions={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              window.print();
            }}
          >
            <Icon icon={Download} />
            Télécharger le PDF
          </Button>
          {editable ? (
            <Button
              onClick={() => {
                setError(null);
                setConfirming(true);
              }}
            >
              <Icon icon={Send} />
              Publier le compte rendu
            </Button>
          ) : null}
          {detail.state === "a_generer" ? (
            <Button loading={generate.isPending} onClick={generateNow}>
              Générer le compte rendu
            </Button>
          ) : null}
        </>
      }
    >
      <PrintStyles />
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card role="region" aria-label="Aperçu du PDF" className="min-w-0 gap-0 p-0">
          <div role="toolbar" aria-label="Barre d'outils de l'aperçu" className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
            <IconButton label="Page précédente" icon={ChevronLeft} size="sm" disabled={current <= 1} onClick={() => { setPage(current - 1); }} />
            <span aria-live="polite" className="text-caption text-fg-muted">{`Page ${String(current)} sur ${String(total)}`}</span>
            <IconButton label="Page suivante" icon={ChevronRight} size="sm" disabled={current >= total} onClick={() => { setPage(current + 1); }} />
            <span aria-hidden="true" className="mx-1 h-4 w-px bg-line" />
            <IconButton label="Réduire" icon={Minus} size="sm" disabled={zoom <= ZOOM_MIN} onClick={() => { setZoom(zoom - ZOOM_STEP); }} />
            <span aria-live="polite" className="min-w-10 text-center text-caption text-fg-muted">{`${String(zoom)} %`}</span>
            <IconButton label="Agrandir" icon={Plus} size="sm" disabled={zoom >= ZOOM_MAX} onClick={() => { setZoom(zoom + ZOOM_STEP); }} />
            <span className="ml-auto" />
            <IconButton
              label="Imprimer"
              icon={Printer}
              size="sm"
              onClick={() => {
                window.print();
              }}
            />
          </div>
          <div className="max-h-[80vh] max-w-full overflow-auto bg-muted p-3">
            <ReportPaper detail={detail} works={works} worksError={interventions.isError} page={current} zoom={zoom} />
          </div>
        </Card>
        <aside className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-label="Paramètres">
            <CardHeader>
              <CardTitle as="h2">Paramètres</CardTitle>
              {detail.state === "publie" ? null : (
                <LinkButton href={`/comptes-rendus/nouveau?reprise=${detail.id}`} variant="ghost" size="sm">
                  Modifier
                </LinkButton>
              )}
            </CardHeader>
            <DetailList
              items={[
                { label: "Période", value: detail.periodLabel },
                { label: "Mandant", value: mandantName },
                { label: "Mandat", value: statement.mandateRef },
                { label: "Publication", value: publication },
              ]}
            />
          </Card>
          <Card role="region" aria-label="Options du PDF">
            <CardHeader>
              <CardTitle as="h2">Options du PDF</CardTitle>
            </CardHeader>
            <SwitchRow label="Quittances jointes" checked={detail.options.receiptsAttached} disabled={!editable} onCheckedChange={(value) => { changeOption("receiptsAttached", value); }} />
            <SwitchRow label="Papier à en-tête" checked={detail.options.letterhead} disabled={!editable} onCheckedChange={(value) => { changeOption("letterhead", value); }} />
            <SwitchRow label="Détail des relances" checked={detail.options.reminderDetail} disabled={!editable} onCheckedChange={(value) => { changeOption("reminderDetail", value); }} />
            {editable ? null : <p className="text-caption text-fg-subtle">{detail.state === "publie" ? "Ce compte rendu est publié : ses options sont figées." : "Générez le compte rendu pour régler ses options."}</p>}
          </Card>
          <Card role="region" aria-label="Contenu">
            <CardHeader>
              <CardTitle as="h2">Contenu</CardTitle>
            </CardHeader>
            <SummaryLines
              lines={[
                { label: "Pages", value: total },
                { label: "Lots", value: statement.lines.length },
                { label: "Quittances", value: detail.options.receiptsAttached ? detail.receipts.length : 0 },
                { label: "Net à reverser", value: formatMoneyExact(statement.netMinor) },
              ]}
            />
          </Card>
        </aside>
      </div>
      <ActionDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Publier le compte rendu ?"
        description={`Le compte rendu de ${mandantName} (${detail.periodLabel.toLowerCase()}) sera visible dans son espace propriétaire${detail.notify ? " et il sera prévenu par e-mail" : ""}. Cette action est définitive.`}
        confirmLabel="Publier"
        loading={publish.isPending}
        error={error}
        onConfirm={confirmPublish}
      />
    </PageFrame>
  );
}
