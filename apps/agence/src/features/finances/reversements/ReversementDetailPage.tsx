"use client";

import { Alert, Badge, Button, Dialog, DialogClose, DialogContent, Icon } from "@eguardimmo/ui";
import { CircleCheck, Download, Wallet } from "lucide-react";
import { useState } from "react";
import { ListRow } from "@/components/ui/ListRow";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { QueryState } from "@/components/ui/QueryState";
import { RowMenu } from "@/components/ui/RowMenu";
import { SectionCard } from "@/components/ui/SectionCard";
import { DataTable, DetailList, DialogBody, DialogFooter, Kpi, KpiGrid, LinkButton, PageFrame, SummaryLines, useNotify } from "@/features/kit";
import type { Column } from "@/features/kit";
import { mandantHref } from "@/espace/routes";
import { formatDate, formatPeriod } from "@/features/shared/dates";
import { messageOf } from "@/features/shared/errors";
import { formatMoneyExact } from "@/features/shared/money";
import { downloadCsv, toCsv } from "@/lib/csv";
import { csvAmount, dateOrDash, joinLabels, plural, rateText } from "../format";
import { useIncludeInLot, useReversementDetail } from "../hooks";
import type { ReversementDetail } from "../schemas";
import { BlockDialog } from "./BlockDialog";

type Line = ReversementDetail["lines"][number];
type HistoryItem = ReversementDetail["history"][number];

export function ReversementDetailPage({ mandantId }: { mandantId: string }) {
  const query = useReversementDetail(mandantId);
  return (
    <QueryState query={query} label="Le reversement">
      {(detail) =>
        detail ? (
          <Detail detail={detail} />
        ) : (
          <NotFoundState title="Reversement introuvable" description="Ce mandant n'existe pas ou n'a aucun reversement pour cette période." backHref="/finances/reversements" backLabel="Retour aux reversements" />
        )
      }
    </QueryState>
  );
}

function statusBadge(detail: ReversementDetail) {
  if (detail.status === "reverse") return <Badge tone="success">{`Reversé le ${formatDate(detail.scheduledOn)}`}</Badge>;
  if (detail.status === "bloque") return <Badge tone="danger">Reversement bloqué</Badge>;
  return <Badge tone="info">{`À reverser le ${formatDate(detail.scheduledOn)}`}</Badge>;
}

function Detail({ detail }: { detail: ReversementDetail }) {
  const notify = useNotify();
  const include = useIncludeInLot();
  const [blockMode, setBlockMode] = useState<"block" | "unblock" | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const periodLabel = formatPeriod(detail.period).toLowerCase();

  const columns: Column<Line>[] = [
    {
      id: "lot",
      header: "Lot",
      role: "title",
      cell: (row) => (
        <>
          <span className="block">{row.lotLabel}</span>
          <span className="block text-caption font-normal text-fg-subtle">{row.lotDescription}</span>
        </>
      ),
    },
    { id: "tenant", header: "Locataire", cell: (row) => row.tenantName },
    { id: "date", header: "Date", cell: (row) => dateOrDash(row.paidOn) },
    { id: "called", header: "Appelé", numeric: true, cell: (row) => formatMoneyExact(row.calledMinor) },
    { id: "collected", header: "Encaissé", numeric: true, cell: (row) => <span className={row.collectedMinor === 0 && row.calledMinor > 0 ? "text-fg-danger" : undefined}>{formatMoneyExact(row.collectedMinor)}</span> },
    { id: "fee", header: "Honoraires", numeric: true, cell: (row) => formatMoneyExact(row.feeMinor) },
    { id: "net", header: "Net", numeric: true, cell: (row) => formatMoneyExact(row.netMinor) },
  ];

  const exportStatement = () => {
    const rows = detail.lines.map((line) => [line.lotLabel, line.tenantName, dateOrDash(line.paidOn), csvAmount(line.calledMinor), csvAmount(line.collectedMinor), csvAmount(line.feeMinor), csvAmount(line.netMinor)]);
    downloadCsv(`decompte-${detail.mandantId}-${detail.period}.csv`, toCsv(["Lot", "Locataire", "Date", "Appelé", "Encaissé", "Honoraires", "Net"], rows));
    notify.success("Décompte téléchargé", `${detail.name}, ${periodLabel}.`);
  };

  const includeInLot = () => {
    include.mutate(
      { mandantId: detail.mandantId },
      {
        onSuccess: () => {
          notify.success("Mandant ajouté au lot de virements", detail.name);
        },
        onError: (error) => {
          notify.error("Ajout impossible", messageOf(error));
        },
      },
    );
  };

  const menu = [
    ...(detail.status === "a_reverser" ? [{ id: "block", label: "Bloquer le reversement", tone: "danger" as const, onSelect: () => { setBlockMode("block"); } }] : []),
    ...(detail.status === "bloque" ? [{ id: "unblock", label: "Débloquer le reversement", onSelect: () => { setBlockMode("unblock"); } }] : []),
    { id: "mandant", label: `Voir ${detail.name}`, href: mandantHref(detail.mandantId), separatorBefore: true },
  ];

  const lotAction =
    detail.status === "a_reverser" && !detail.inBatch ? (
      <Button loading={include.isPending} onClick={includeInLot}>
        <Icon icon={Wallet} />
        Inclure dans le lot
      </Button>
    ) : detail.inBatch ? (
      <LinkButton href="/finances/reversements/lot" variant="primary">
        Voir le lot de virements
      </LinkButton>
    ) : null;

  return (
    <PageFrame
      crumbs={[{ label: "Reversements", href: "/finances/reversements" }, { label: detail.name }]}
      title={`Reversement, ${detail.name}`}
      badges={statusBadge(detail)}
      description={`${detail.kind} · Mandat ${detail.mateRef} · Loyers de ${periodLabel} · ${plural(detail.lines.length, "lot", "lots")}`}
      actions={
        <>
          <Button variant="secondary" onClick={exportStatement}>
            <Icon icon={Download} />
            Télécharger le décompte
          </Button>
          {lotAction}
          <RowMenu label="Plus d'actions sur le reversement" items={menu} />
        </>
      }
    >
      {detail.status === "bloque" ? (
        <Alert tone="danger" title="Reversement bloqué">
          {detail.blockedReason ?? "Motif non renseigné."} Ce mandant n'est pas inclus dans le lot de virements.
        </Alert>
      ) : null}
      <KpiGrid columns={4}>
        <Kpi label="Loyers encaissés" value={formatMoneyExact(detail.collectedMinor)} hint={`sur ${formatMoneyExact(detail.calledMinor)} appelés`} />
        <Kpi label={`Honoraires, ${rateText(detail.rateBp)} TTC`} value={formatMoneyExact(detail.feeMinor)} hint="Retenus sur le reversement" />
        <Kpi label="Net à reverser" value={formatMoneyExact(detail.netMinor)} hint="Virement SEPA" />
        <Kpi label="Date" value={formatDate(detail.scheduledOn)} hint="Prochain jour ouvré" />
      </KpiGrid>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard title="Détail par lot">
          <div className="flex flex-col gap-2 px-4 pb-4">
            <DataTable
              caption="Détail par lot"
              rows={detail.lines}
              getRowId={(row) => row.lotId}
              columns={columns}
              footer={{ called: formatMoneyExact(detail.calledMinor), collected: formatMoneyExact(detail.collectedMinor), fee: formatMoneyExact(detail.feeMinor), net: formatMoneyExact(detail.netMinor) }}
            />
            {detail.unpaidLabels.length > 0 ? (
              <p className="text-caption text-fg-subtle">
                {`${joinLabels(detail.unpaidLabels)} ${detail.unpaidLabels.length > 1 ? "ne sont pas encaissés : ils seront reversés" : "n'est pas encaissé : il sera reversé"} après paiement, avec ${detail.unpaidLabels.length > 1 ? "leurs" : "ses"} ${formatMoneyExact(detail.pendingFeeMinor)} d'honoraires.`}
              </p>
            ) : null}
          </div>
        </SectionCard>
        <div className="flex min-w-0 flex-col gap-3">
          <SectionCard title="Calcul du reversement">
            <div className="px-4 pb-4">
              <SummaryLines
                lines={[
                  { label: "Loyers encaissés", value: formatMoneyExact(detail.collectedMinor) },
                  { label: "Honoraires HT", value: formatMoneyExact(-detail.htMinor) },
                  { label: "TVA 20 %", value: formatMoneyExact(-detail.vatMinor) },
                  { label: "Travaux déduits", value: formatMoneyExact(-detail.worksMinor) },
                ]}
                total={{ label: "Net à reverser", value: formatMoneyExact(detail.netMinor) }}
              />
            </div>
          </SectionCard>
          <SectionCard title="Bénéficiaire">
            <div className="px-4 pb-4">
              <DetailList
                items={[
                  { label: "Mandant", value: detail.name },
                  { label: "Compte", value: `IBAN •••• ${detail.ibanLast4}` },
                  { label: "Libellé", value: `Loyers ${detail.period.slice(5)}/${detail.period.slice(0, 4)}` },
                  { label: "Mode", value: "Virement SEPA" },
                ]}
              />
            </div>
          </SectionCard>
        </div>
      </div>
      <SectionCard
        title="Reversements précédents"
        action={
          detail.history.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setHistoryOpen(true);
              }}
            >
              {`Tout voir, ${String(detail.history.length)}`}
            </Button>
          ) : null
        }
      >
        <div className="px-4 pb-3">
          {detail.history.length === 0 ? (
            <p className="py-2 text-body text-fg-subtle">Aucun reversement précédent pour ce mandat.</p>
          ) : (
            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-3">
              {detail.history.slice(0, 3).map((item) => (
                <HistoryRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </SectionCard>
      <BlockDialog mandantId={detail.mandantId} name={detail.name} mode={blockMode} onClose={() => { setBlockMode(null); }} />
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent title={`Reversements de ${detail.name}`} description={`${plural(detail.history.length, "reversement", "reversements")} depuis le début du mandat.`}>
          <DialogBody>
            <div className="max-h-[50vh] overflow-y-auto">
              {detail.history.map((item) => (
                <HistoryRow key={item.id} item={item} />
              ))}
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" data-autofocus>
                Fermer
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}

function HistoryRow({ item }: { item: HistoryItem }) {
  return (
    <ListRow
      icon={CircleCheck}
      tone="success"
      title={formatPeriod(item.period)}
      caption={`${formatDate(item.paidOn)} · ${formatMoneyExact(item.feeMinor)} d'honoraires`}
      trailing={<b className="text-body-strong tabular-nums">{formatMoneyExact(item.netMinor)}</b>}
    />
  );
}
