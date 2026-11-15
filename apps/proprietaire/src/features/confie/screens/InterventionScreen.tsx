"use client";

import { Badge, Button, StatCard } from "@eguardimmo/ui";
import { CircleAlert, CircleCheck, CircleX, Clock, FileText } from "lucide-react";
import Link from "next/link";
import { daysBetween, formatDate, ofMonth, plural } from "../data/dates";
import { lotLabel } from "../data/derive";
import { useConfie } from "../data/queries";
import type { ConfieData, Intervention } from "../data/schemas";
import { eur, eurFixed, vatIncluded } from "../data/money";
import { confieRoutes } from "../routes";
import { DataList } from "../ui/DataList";
import { ListRow, RowList } from "../ui/ListRow";
import type { RowTone } from "../ui/ListRow";
import { PageHeader } from "../ui/PageHeader";
import { DownloadButton, INTERVENTION_STATUS, PrimaryDownload } from "../ui/parts";
import { Caption, Pair, Section, StatGrid } from "../ui/Section";
import { NotFoundState, QueryBoundary } from "../ui/States";

export function InterventionScreen({ id }: { id: string }) {
  const query = useConfie();
  return (
    <QueryBoundary query={query}>
      {(data) => {
        const intervention = data.interventions.find((item) => item.id === id);
        return intervention ? <InterventionDetail data={data} intervention={intervention} /> : <NotFoundState title="Intervention introuvable" backHref={confieRoutes.interventions} backLabel="Retour aux interventions" />;
      }}
    </QueryBoundary>
  );
}

const TIMELINE_ICONS = { default: Clock, warning: CircleAlert, success: CircleCheck, danger: CircleX } as const;
const TIMELINE_TONES: Record<keyof typeof TIMELINE_ICONS, RowTone> = { default: "default", warning: "warning", success: "success", danger: "danger" };

function InterventionDetail({ data, intervention }: { data: ConfieData; intervention: Intervention }) {
  const label = lotLabel(data, intervention.lotId);
  const title = `${intervention.title}, ${label}`;
  const vat = vatIncluded(intervention.totalTtc, intervention.vatRatePercent);
  const status = INTERVENTION_STATUS[intervention.status];
  const threshold = data.mandate.worksThreshold;
  const approval = intervention.totalTtc <= threshold ? "Non requis" : intervention.decision?.kind === "accept" ? "Accepté" : intervention.decision?.kind === "refuse" ? "Refusé" : "Requis";
  const imputedSettlement = data.settlements.find((settlement) => settlement.reversedOn === intervention.imputedOn);
  const endDate = intervention.doneOn ?? data.today;
  const delay = daysBetween(intervention.reportedOn, endDate);
  const subtitle = `Intervention n° ${intervention.ref} · ${intervention.artisan}${intervention.doneOn ? ` · terminée le ${formatDate(intervention.doneOn)}` : ""}`;

  return (
    <>
      <PageHeader
        title={title}
        crumbs={[{ label: "Interventions", href: confieRoutes.interventions }, { label: title }]}
        badges={<Badge tone={status.tone}>{status.label}</Badge>}
        subtitle={subtitle}
        actions={
          intervention.status === "quote_pending" ? (
            <Button asChild><Link href={confieRoutes.devis(intervention.id)}>Examiner le devis</Link></Button>
          ) : intervention.status === "done" ? (
            <PrimaryDownload title={`Facture, ${intervention.title}, ${label}`} label="Télécharger la facture" />
          ) : null
        }
      />
      <StatGrid>
        <StatCard label="Montant" value={eurFixed(intervention.totalTtc)}><Caption>TTC, dont {eurFixed(vat)} de TVA</Caption></StatCard>
        <StatCard label="Accord" value={approval}>
          <Caption>{intervention.totalTtc <= threshold ? `Sous le seuil de ${eur(threshold)} du mandat` : `Au-dessus du seuil de ${eur(threshold)} du mandat`}</Caption>
        </StatCard>
        <StatCard label="Imputé le" value={intervention.imputedOn ? formatDate(intervention.imputedOn) : "—"}>
          <Caption>{imputedSettlement ? `Reversement ${ofMonth(imputedSettlement.month)}` : "Pas encore imputé"}</Caption>
        </StatCard>
        <StatCard label="Délai" value={plural(delay, "jour")}>
          <Caption>{intervention.doneOn ? `Du ${formatDate(intervention.reportedOn).slice(0, 5)} au ${formatDate(intervention.doneOn)}` : `En cours depuis le ${formatDate(intervention.reportedOn)}`}</Caption>
        </StatCard>
      </StatGrid>
      <Section title="Suivi">
        <RowList label="Suivi de l'intervention">
          {intervention.timeline.map((entry) => (
            <ListRow
              key={entry.id}
              icon={TIMELINE_ICONS[entry.tone]}
              tone={TIMELINE_TONES[entry.tone]}
              title={entry.title}
              detail={entry.detail}
              trailing={entry.id === "terminee" ? <Badge tone="success">Terminée</Badge> : undefined}
            />
          ))}
        </RowList>
      </Section>
      <Pair>
        <Section title="Détails">
          <DataList
            width="lg"
            items={[
              { label: "Lot", value: label },
              { label: "Catégorie", value: intervention.category },
              { label: "Artisan", value: intervention.artisan },
              { label: "Montant HT", value: eurFixed(intervention.totalTtc - vat) },
              { label: `TVA ${String(intervention.vatRatePercent)} %`, value: eurFixed(vat) },
              { label: "Montant TTC", value: <b>{eurFixed(intervention.totalTtc)}</b> },
            ]}
          />
        </Section>
        <Section title="Pièces">
          <RowList label="Pièces de l'intervention">
            {intervention.files.map((file) => (
              <ListRow key={file.id} icon={FileText} title={file.title} detail={file.detail} trailing={<DownloadButton title={`${file.title}, ${intervention.title}, ${label}`} />} />
            ))}
          </RowList>
        </Section>
      </Pair>
    </>
  );
}
