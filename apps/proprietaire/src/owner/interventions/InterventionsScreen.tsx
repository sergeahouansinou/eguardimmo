"use client";

import { Badge } from "@eguardimmo/ui";
import { Wrench } from "lucide-react";
import Link from "next/link";
import { confieRoutes } from "@/features/confie/routes";
import { DataTable } from "@/features/confie/ui/DataTable";
import type { Column } from "@/features/confie/ui/DataTable";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Section } from "@/features/confie/ui/Section";
import { NOT_AVAILABLE, formatDay, formatOptionalDay, formatOptionalMoney, labelOf } from "../format";
import { AgencyFilter } from "../shared/AgencyFilter";
import { PagedState } from "../shared/PagedState";
import { useAgencyFilter } from "../shared/useAgencyFilter";
import { INTERVENTION_STATUS, PRIORITY } from "./labels";
import type { OwnerIntervention } from "./model";
import { useInterventions } from "./queries";

export function StatusBadge({ status }: { status: string }) {
  const entry = INTERVENTION_STATUS[status];
  return <Badge tone={entry?.tone ?? "neutral"}>{entry?.label ?? labelOf({}, status)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const entry = PRIORITY[priority];
  return <Badge tone={entry?.tone ?? "neutral"}>{entry?.label ?? labelOf({}, priority)}</Badge>;
}

export function placeOf(intervention: Pick<OwnerIntervention, "propertyName" | "unitReference" | "commonArea">): string {
  const property = intervention.propertyName ?? NOT_AVAILABLE;
  return intervention.commonArea ? `${property} · parties communes` : `${property} · lot ${intervention.unitReference ?? NOT_AVAILABLE}`;
}

const columns: readonly Column<OwnerIntervention>[] = [
  {
    id: "reference",
    header: "Intervention",
    primary: true,
    cell: (intervention) => (
      <Link href={confieRoutes.intervention(intervention.id)} className="underline-offset-2 hover:underline">
        {`${intervention.reference} · ${intervention.title}`}
      </Link>
    ),
  },
  { id: "statut", header: "Statut", cell: (intervention) => <StatusBadge status={intervention.status} /> },
  { id: "priorite", header: "Priorité", cell: (intervention) => <PriorityBadge priority={intervention.priority} /> },
  { id: "lieu", header: "Lieu", cell: placeOf },
  { id: "prestataire", header: "Prestataire", cell: (intervention) => intervention.supplierName ?? "Pas encore désigné" },
  { id: "signalee", header: "Signalée le", cell: (intervention) => formatDay(intervention.reportedOn) },
  { id: "echeance", header: "Échéance", cell: (intervention) => formatOptionalDay(intervention.dueOn) },
  { id: "estimation", header: "Estimation", align: "end", cell: (intervention) => formatOptionalMoney(intervention.estimatedAmount) },
];

export function InterventionsScreen() {
  const filter = useAgencyFilter();
  const list = useInterventions(filter.agency, !filter.unknown);
  return (
    <>
      <PageHeader title="Interventions" subtitle="Les travaux et dépannages suivis par votre agence sur vos lots" />
      <AgencyFilter filter={filter} />
      {filter.unknown ? null : (
        <PagedState
          list={list}
          loadingLabel="Chargement de vos interventions"
          failureTitle="Vos interventions n’ont pas pu être chargées"
          empty={{ icon: Wrench, title: "Aucune intervention", description: "Aucune intervention n’est suivie sur vos lots pour cette sélection." }}
        >
          {(interventions) => (
            <Section title="Interventions suivies">
              <DataTable caption="Interventions sur vos lots" columns={columns} rows={interventions.map((intervention) => ({ key: intervention.id, value: intervention }))} />
            </Section>
          )}
        </PagedState>
      )}
    </>
  );
}
