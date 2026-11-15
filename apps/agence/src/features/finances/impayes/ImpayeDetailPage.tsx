"use client";

import { Badge, Button, Icon } from "@eguardimmo/ui";
import { CalendarClock, CircleAlert, CircleCheck, CircleX, FileText, Mail, MessageSquare, Phone, UserCheck, BellRing, Banknote } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { ListRow } from "@/components/ui/ListRow";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { QueryState } from "@/components/ui/QueryState";
import { RowMenu } from "@/components/ui/RowMenu";
import { SectionCard } from "@/components/ui/SectionCard";
import { ActionDialog, DetailList, Kpi, KpiGrid, LinkButton, PageFrame, SummaryLines, Timeline, useNotify } from "@/features/kit";
import type { TimelineItem, TimelineTone } from "@/features/kit";
import { formatDate } from "@/features/shared/dates";
import { messageOf } from "@/features/shared/errors";
import { formatMoney, formatMoneyExact } from "@/features/shared/money";
import { agenceRoutes, mandantHref } from "@/espace/routes";
import { downloadCsv, toCsv } from "@/lib/csv";
import { dateOrDash, plural, rateText } from "../format";
import { useImpayeDetail, useInformMandant, usePrepareNotice } from "../hooks";
import type { ImpayeDetail } from "../schemas";
import { InfoDialog } from "../ui/InfoDialog";
import { PlanDialog } from "./PlanDialog";
import { ReminderDialog } from "./ReminderDialog";

type EventKind = ImpayeDetail["events"][number]["kind"];

const EVENT_STYLE: Record<EventKind, { icon: LucideIcon; tone: TimelineTone }> = {
  echeance: { icon: CircleAlert, tone: "danger" },
  relance: { icon: Mail, tone: "neutral" },
  appel: { icon: Phone, tone: "neutral" },
  mandant: { icon: UserCheck, tone: "neutral" },
  message: { icon: MessageSquare, tone: "warning" },
  mise_en_demeure: { icon: FileText, tone: "default" },
  echeancier: { icon: CalendarClock, tone: "default" },
  paiement: { icon: CircleCheck, tone: "success" },
  rejet: { icon: CircleX, tone: "danger" },
};

export function ImpayeDetailPage({ lotId }: { lotId: string }) {
  const query = useImpayeDetail(lotId);
  return (
    <QueryState query={query} label="Le dossier d'impayé">
      {(detail) =>
        detail ? (
          <Detail detail={detail} />
        ) : (
          <NotFoundState title="Impayé introuvable" description="Ce dossier n'existe pas ou l'impayé a été régularisé." backHref={agenceRoutes.impayes} backLabel="Retour aux impayés" />
        )
      }
    </QueryState>
  );
}

type Dialogs = "reminder" | "plan" | "notice" | "guarantor" | null;

function Detail({ detail }: { detail: ImpayeDetail }) {
  const notify = useNotify();
  const [dialog, setDialog] = useState<Dialogs>(null);
  const notice = usePrepareNotice();
  const inform = useInformMandant();
  const close = () => {
    setDialog(null);
  };

  const timeline: TimelineItem[] = detail.events.map((event) => ({
    id: event.id,
    title: event.title,
    detail: `${formatDate(event.date)} · ${event.detail}`,
    icon: EVENT_STYLE[event.kind].icon,
    tone: event.planned ? "default" : EVENT_STYLE[event.kind].tone,
    ...(event.badge ? { trailing: <Badge tone={event.badge.tone}>{event.badge.label}</Badge> } : {}),
  }));

  const exportDossier = () => {
    downloadCsv(`impaye-${detail.lotId}.csv`, toCsv(["Date", "Événement", "Détail"], detail.events.map((event) => [formatDate(event.date), event.title, event.detail])));
    notify.success("Dossier exporté", `${plural(detail.events.length, "événement", "événements")} dans le fichier.`);
  };

  const informMandant = () => {
    inform.mutate({ lotId: detail.lotId }, { onSuccess: () => { notify.success("Mandant informé", `${detail.mandantName} voit l'impayé dans son espace.`); } });
  };

  const sendNotice = () => {
    notice.mutate(
      { lotId: detail.lotId },
      {
        onSuccess: () => {
          notify.success("Mise en demeure envoyée", `Courrier recommandé à ${detail.tenantName}.`);
          close();
        },
      },
    );
  };

  return (
    <PageFrame
      crumbs={[{ label: "Impayés", href: agenceRoutes.impayes }, { label: `${detail.lotLabel}, ${detail.tenantName}` }]}
      title={`Impayé, ${detail.lotLabel}`}
      badges={
        <>
          <Badge tone="danger">{`Impayé, ${plural(detail.overdueDays, "jour", "jours")}`}</Badge>
          <Badge tone="warning">{plural(detail.reminders, "relance", "relances")}</Badge>
        </>
      }
      description={`${detail.tenantName} · ${detail.mandantName}, ${detail.mandantKind} · échéance du ${formatDate(detail.dueOn)} · ${formatMoney(detail.remainingMinor)} dus`}
      actions={
        <>
          <LinkButton href={agenceRoutes.messageNew}>
            <Icon icon={MessageSquare} />
            Écrire
          </LinkButton>
          <Button
            variant="secondary"
            onClick={() => {
              setDialog("reminder");
            }}
          >
            <Icon icon={BellRing} />
            Envoyer une relance
          </Button>
          <LinkButton href={`/finances/encaissements/nouveau?lot=${detail.lotId}`} variant="primary">
            <Icon icon={Banknote} />
            Saisir un paiement
          </LinkButton>
          <RowMenu
            label="Plus d'actions sur l'impayé"
            items={[
              { id: "inform", label: "Informer le mandant", onSelect: informMandant },
              { id: "export", label: "Exporter le dossier", onSelect: exportDossier },
              { id: "mandant", label: `Voir ${detail.mandantName}`, href: mandantHref(detail.mandantId), separatorBefore: true },
            ]}
          />
        </>
      }
    >
      <KpiGrid columns={4}>
        <Kpi label="Reste dû" value={formatMoneyExact(detail.remainingMinor)} tone="danger" hint={detail.installmentLabel} />
        <Kpi label="Retard" value={plural(detail.overdueDays, "jour", "jours")} hint={`Depuis le ${formatDate(detail.dueOn)}`} />
        <Kpi label="Relances envoyées" value={String(detail.reminders)} hint={detail.lastReminderOn ? `Dernière le ${formatDate(detail.lastReminderOn)}` : "Aucune relance"} />
        <Kpi label="Prochaine étape" value={dateOrDash(detail.nextStep.dueOn)} hint={detail.nextStep.recommendation} />
      </KpiGrid>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard title="Chronologie du dossier">
          <div className="px-4 pb-3">
            <Timeline label="Chronologie du dossier" items={timeline} />
          </div>
        </SectionCard>
        <div className="flex min-w-0 flex-col gap-3">
          <SectionCard title="Dossier">
            <div className="px-4 pb-4">
              <DetailList
                items={[
                  { label: "Locataire", value: detail.tenantName },
                  { label: "Lot", value: `${detail.lotLabel}, ${detail.address}` },
                  { label: "Mandant", value: detail.mandantName },
                  { label: "Loyer", value: `${formatMoney(detail.rentMinor)} + ${formatMoney(detail.chargesMinor)} de charges` },
                  { label: "Honoraires", value: `${formatMoneyExact(detail.pendingFeeMinor)}, non prélevés` },
                  { label: "Dépôt", value: `${formatMoney(detail.depositMinor)}, détenu` },
                ]}
              />
            </div>
          </SectionCard>
          <SectionCard title="Impact sur le reversement">
            <div className="flex flex-col gap-2 px-4 pb-4">
              <SummaryLines
                lines={[
                  { label: `Loyers encaissés, ${detail.impact.lotsLabel}`, value: formatMoneyExact(detail.impact.collectedMinor) },
                  { label: `Honoraires, ${rateText(detail.impact.rateBp)} TTC`, value: formatMoneyExact(-detail.impact.feeMinor) },
                ]}
                total={{ label: "Reversement prévu", value: formatMoneyExact(detail.impact.netMinor) }}
              />
              <p className="text-caption text-fg-subtle">{`${detail.lotLabel} sera reversé après encaissement, moins ${formatMoneyExact(detail.pendingFeeMinor)} d'honoraires.`}</p>
            </div>
          </SectionCard>
          {detail.plan ? (
            <SectionCard title="Plan d'apurement">
              <div className="flex flex-col gap-2 px-4 pb-4">
                <p className="text-caption text-fg-subtle">{`Proposé le ${formatDate(detail.plan.proposedOn)}`}</p>
                <SummaryLines lines={detail.plan.lines.map((line) => ({ label: formatDate(line.dueOn), value: formatMoneyExact(line.amountMinor) }))} />
              </div>
            </SectionCard>
          ) : null}
        </div>
      </div>
      <SectionCard title="Actions possibles">
        <div className="grid grid-cols-1 gap-3 px-4 pb-3 md:grid-cols-3">
          <ListRow
            icon={CalendarClock}
            title="Proposer un échéancier"
            caption={detail.plan ? plural(detail.plan.lines.length, "mensualité proposée", "mensualités proposées") : `Étaler les ${formatMoney(detail.remainingMinor)} sur 2 mois`}
            trailing={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDialog("plan");
                }}
              >
                {detail.plan ? "Modifier" : "Proposer"}
              </Button>
            }
          />
          <ListRow
            icon={FileText}
            tone="warning"
            title="Mise en demeure"
            caption={detail.noticeOn ? `Envoyée le ${formatDate(detail.noticeOn)}` : "Courrier recommandé avec accusé"}
            trailing={
              <Button
                size="sm"
                variant="secondary"
                disabled={detail.noticeOn !== null}
                onClick={() => {
                  setDialog("notice");
                }}
              >
                {detail.noticeOn ? "Envoyée" : "Préparer"}
              </Button>
            }
          />
          <ListRow
            icon={UserCheck}
            title="Contacter le garant"
            caption="Aucun garant au bail"
            trailing={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDialog("guarantor");
                }}
              >
                Vérifier
              </Button>
            }
          />
        </div>
      </SectionCard>
      <ReminderDialog open={dialog === "reminder"} onOpenChange={(open) => { if (!open) close(); }} lotIds={[detail.lotId]} recipients={[detail.tenantName]} />
      <PlanDialog open={dialog === "plan"} onOpenChange={(open) => { if (!open) close(); }} lotId={detail.lotId} remainingMinor={detail.remainingMinor} />
      <ActionDialog
        open={dialog === "notice"}
        onOpenChange={(open) => { if (!open) close(); }}
        title="Envoyer une mise en demeure"
        description={`Un courrier recommandé avec accusé de réception sera envoyé à ${detail.tenantName} pour ${formatMoneyExact(detail.remainingMinor)}. L'envoi est tracé dans le dossier et ne peut pas être annulé.`}
        confirmLabel="Envoyer la mise en demeure"
        loading={notice.isPending}
        error={notice.isError ? messageOf(notice.error) : null}
        onConfirm={sendNotice}
      />
      <InfoDialog open={dialog === "guarantor"} onOpenChange={(open) => { if (!open) close(); }} title="Contacter le garant" description={`Aucun garant n'est rattaché au bail de ${detail.tenantName}. Vérifiez le contrat de location avant toute démarche auprès d'un tiers.`} />
    </PageFrame>
  );
}
