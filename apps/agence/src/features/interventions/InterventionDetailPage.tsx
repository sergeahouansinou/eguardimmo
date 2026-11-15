"use client";

import { Badge, Button, Card, CardHeader, CardTitle } from "@eguardimmo/ui";
import { Archive, CircleCheck, FileText, TriangleAlert, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { QueryState } from "@/components/ui/QueryState";
import { RowMenu } from "@/components/ui/RowMenu";
import type { RowMenuItem } from "@/components/ui/RowMenu";
import { DetailList, Kpi, KpiGrid, LinkButton, PageFrame, Timeline, useNotify } from "@/features/kit";
import type { TimelineItem } from "@/features/kit";
import { formatDate, formatDateTime, formatDayMonth } from "@/features/shared/dates";
import { lotById, mandantById, tenantById } from "@/features/shared/directory";
import { messageOf } from "@/features/shared/errors";
import { formatMoney } from "@/features/shared/money";
import { InterventionActionDialogs } from "./InterventionActionDialogs";
import type { PendingAction } from "./InterventionActionDialogs";
import { phoneHref } from "./contractors";
import { PRIORITY_LABELS, PRIORITY_TONES, STATUS_LABELS, STATUS_TONES } from "./labels";
import { useChangeStatus, useDevisList, useIntervention } from "./queries";
import { TRANSITIONS } from "./rules";
import { dueHint } from "./selectors";
import type { ChangeableStatus, Devis, Intervention, InterventionEvent } from "./schemas";

const TONE_ICONS: Record<InterventionEvent["tone"], LucideIcon> = {
  default: Wrench,
  success: CircleCheck,
  warning: FileText,
  danger: TriangleAlert,
  neutral: Archive,
};

const STATUS_ACTIONS: Record<ChangeableStatus, string> = {
  en_cours: "Démarrer l'intervention",
  terminee: "Clôturer l'intervention",
  archivee: "Archiver l'intervention",
  ouverte: "Rouvrir l'intervention",
};

export function InterventionDetailPage({ id }: { id: string }) {
  const intervention = useIntervention(id);
  const devis = useDevisList();
  return (
    <QueryState query={intervention} label="L'intervention">
      {(data) =>
        data === null ? (
          <NotFoundState
            title="Intervention introuvable"
            description="Cette intervention n'existe pas ou a été supprimée."
            backHref="/interventions"
            backLabel="Retour aux interventions"
          />
        ) : (
          <QueryState query={devis} label="Le devis">
            {(devisList) => <InterventionDetail intervention={data} devis={devisList.find((item) => item.id === data.devisId) ?? null} />}
          </QueryState>
        )
      }
    </QueryState>
  );
}

function timelineOf(intervention: Intervention, devis: Devis | null, mandantName: string): TimelineItem[] {
  const items: TimelineItem[] = intervention.events.map((event) => ({
    id: event.id,
    title: event.title,
    detail: `${formatDateTime(event.at)}${event.detail ? ` · ${event.detail}` : ""}`,
    icon: TONE_ICONS[event.tone],
    tone: event.tone,
    ...(event.title.startsWith("Devis reçu") && devis?.state === "a_soumettre" ? { trailing: <Badge tone="warning">À soumettre</Badge> } : {}),
  }));
  const waiting =
    intervention.status === "devis_a_soumettre"
      ? "En attente de la soumission du devis"
      : intervention.status === "devis_soumis"
        ? `En attente de la réponse de ${mandantName}`
        : null;
  if (waiting) {
    items.push({ id: "accord", title: "Accord du mandant", detail: waiting, icon: FileText, tone: "neutral", trailing: <Badge tone="neutral">À venir</Badge> });
  }
  return items;
}

function InterventionDetail({ intervention, devis }: { intervention: Intervention; devis: Devis | null }) {
  const notify = useNotify();
  const changeStatus = useChangeStatus();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const mandant = mandantById(intervention.mandantId);
  const lot = intervention.lotId ? lotById(intervention.lotId) : undefined;
  const tenant = intervention.tenantId ? tenantById(intervention.tenantId) : undefined;
  const allowed = TRANSITIONS[intervention.status];

  const runStatus = (status: ChangeableStatus) => {
    changeStatus.mutate(
      { id: intervention.id, status },
      {
        onSuccess: () => {
          notify.success("État mis à jour", `« ${intervention.subject} » : ${STATUS_LABELS[status].toLowerCase()}.`);
        },
        onError: (error) => {
          notify.error("Changement impossible", messageOf(error));
        },
      },
    );
  };

  const menu: RowMenuItem[] = [
    ...allowed.map<RowMenuItem>((status) => ({
      id: status,
      label: STATUS_ACTIONS[status],
      onSelect: () => {
        if (status === "terminee" || status === "archivee") setPending({ kind: "status", status });
        else runStatus(status);
      },
    })),
    { id: "priorite", label: "Changer la priorité", separatorBefore: true, onSelect: () => { setPending({ kind: "priority" }); } },
  ];

  const description = `Signalée par ${intervention.reportedBy} le ${formatDate(intervention.reportedOn)} · mandant ${mandant?.name ?? "—"}`;
  const approval = intervention.approvalRequired;

  return (
    <PageFrame
      crumbs={[{ label: "Interventions", href: "/interventions" }, { label: intervention.subject }]}
      title={`${intervention.subject}, ${intervention.propertyLabel}`}
      badges={
        <>
          <Badge tone={PRIORITY_TONES[intervention.priority]}>{PRIORITY_LABELS[intervention.priority]}</Badge>
          <Badge tone={STATUS_TONES[intervention.status]}>{STATUS_LABELS[intervention.status]}</Badge>
        </>
      }
      description={description}
      actions={
        <>
          {tenant ? (
            <LinkButton href="/messages/nouveau" variant="secondary">
              Écrire au locataire
            </LinkButton>
          ) : null}
          {devis?.state === "a_soumettre" ? (
            <LinkButton href={`/devis?devis=${devis.id}`} variant="primary">
              Soumettre le devis
            </LinkButton>
          ) : null}
          <RowMenu label="Actions sur l'intervention" items={menu} />
        </>
      }
    >
      <KpiGrid columns={4}>
        <Kpi label="Priorité" value={PRIORITY_LABELS[intervention.priority]} hint={intervention.priorityNote ?? undefined} />
        <Kpi
          label="Échéance"
          value={intervention.dueOn ? formatDate(intervention.dueOn) : "—"}
          hint={intervention.status === "terminee" || intervention.status === "archivee" ? "intervention clôturée" : dueHint(intervention.dueOn)}
        />
        <Kpi
          label="Devis reçu"
          value={devis ? `${formatMoney(devis.totalMinor)} TTC` : "Aucun"}
          hint={devis ? `${devis.contractor}, le ${formatDayMonth(devis.issuedOn)}` : "en attente de l'intervenant"}
        />
        <Kpi
          label="Plafond sans accord"
          value={formatMoney(intervention.ceilingMinor)}
          tone={approval ? "danger" : "default"}
          hint={approval ? "accord du mandant requis" : "accord du mandant non requis"}
        />
      </KpiGrid>
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-label="Description">
            <CardHeader>
              <CardTitle as="h2">Description</CardTitle>
            </CardHeader>
            <p className="text-body text-fg-muted">{intervention.description || "Aucune description."}</p>
            {intervention.photos.length > 0 ? (
              <p className="text-caption text-fg-subtle">Photos : {intervention.photos.join(", ")}</p>
            ) : null}
          </Card>
          <Card role="region" aria-label="Suivi">
            <CardHeader>
              <CardTitle as="h2">Suivi</CardTitle>
            </CardHeader>
            <Timeline label="Suivi de l'intervention" items={timelineOf(intervention, devis, mandant?.name ?? "le mandant")} />
          </Card>
        </div>
        <aside className="flex min-w-0 flex-col gap-3">
          <Card role="region" aria-label="Informations">
            <CardHeader>
              <CardTitle as="h2">Informations</CardTitle>
            </CardHeader>
            <DetailList
              items={[
                { label: "Bien", value: intervention.propertyLabel },
                { label: "Adresse", value: lot?.address ?? intervention.address },
                { label: "Mandant", value: mandant?.name ?? "—" },
                { label: "Mandat", value: mandant?.mandateRef ?? "—" },
                { label: "Locataire", value: tenant?.name ?? "—" },
              ]}
            />
          </Card>
          <Card role="region" aria-label="Intervenant">
            <CardHeader>
              <CardTitle as="h2">Intervenant</CardTitle>
            </CardHeader>
            {intervention.contractor ? (
              <>
                <DetailList
                  items={[
                    { label: "Société", value: intervention.contractor },
                    { label: "Contact", value: intervention.contractorContact },
                    { label: "Téléphone", value: intervention.contractorPhone },
                    { label: "Passage", value: intervention.passage ?? "À planifier" },
                  ]}
                />
                <div>
                  <Button variant="secondary" asChild>
                    <a href={phoneHref(intervention.contractorPhone)}>Appeler</a>
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-body text-fg-muted">Aucun intervenant désigné pour le moment.</p>
            )}
          </Card>
        </aside>
      </div>
      <InterventionActionDialogs intervention={intervention} pending={pending} onClose={() => { setPending(null); }} onStatus={runStatus} />
    </PageFrame>
  );
}
