"use client";

import { Badge } from "@eguardimmo/ui";
import { FileText } from "lucide-react";
import Link from "next/link";
import { confieRoutes } from "@/features/confie/routes";
import { DataTable } from "@/features/confie/ui/DataTable";
import type { Column } from "@/features/confie/ui/DataTable";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Section } from "@/features/confie/ui/Section";
import { NOT_AVAILABLE, agencyAndMandant, formatDay, labelOf } from "../format";
import { AgencyFilter } from "../shared/AgencyFilter";
import { PagedState } from "../shared/PagedState";
import { useAgencyFilter } from "../shared/useAgencyFilter";
import { LEASE_PHASE } from "./labels";
import type { OwnerLease } from "./model";
import { useLeases } from "./queries";

export function leasePeriod(lease: Pick<OwnerLease, "startsOn" | "endDate">): string {
  return lease.endDate === null ? `Depuis le ${formatDay(lease.startsOn)}` : `Du ${formatDay(lease.startsOn)} au ${formatDay(lease.endDate)}`;
}

export function PhaseBadge({ phase }: { phase: string }) {
  const entry = LEASE_PHASE[phase];
  return <Badge tone={entry?.tone ?? "neutral"}>{entry?.label ?? labelOf({}, phase)}</Badge>;
}

const columns: readonly Column<OwnerLease>[] = [
  {
    id: "bail",
    header: "Bail",
    primary: true,
    cell: (lease) => (
      <Link href={confieRoutes.bail(lease.id)} className="underline-offset-2 hover:underline">
        {lease.reference ?? "Sans référence"}
      </Link>
    ),
  },
  {
    id: "lot",
    header: "Lot",
    cell: (lease) =>
      lease.mainUnit === null ? (
        NOT_AVAILABLE
      ) : (
        <Link href={confieRoutes.bien(lease.mainUnit.id)} className="underline-offset-2 hover:underline">
          {`${lease.mainUnit.reference} · ${lease.mainUnit.propertyName}`}
        </Link>
      ),
  },
  { id: "locataires", header: "Locataires", cell: (lease) => (lease.tenants.length === 0 ? NOT_AVAILABLE : lease.tenants.map((tenant) => tenant.displayName).join(", ")) },
  { id: "phase", header: "Situation", cell: (lease) => <PhaseBadge phase={lease.phase} /> },
  { id: "periode", header: "Période", cell: leasePeriod },
  { id: "mandat", header: "Mandat", cell: (lease) => agencyAndMandant(lease.agency.name, lease.mandantName) },
];

export function LeasesScreen() {
  const filter = useAgencyFilter();
  const list = useLeases(filter.agency, !filter.unknown);
  return (
    <>
      <PageHeader title="Baux" subtitle="Les baux signés sur vos lots confiés, en consultation" />
      <AgencyFilter filter={filter} />
      {filter.unknown ? null : (
        <PagedState
          list={list}
          loadingLabel="Chargement de vos baux"
          failureTitle="Vos baux n’ont pas pu être chargés"
          empty={{ icon: FileText, title: "Aucun bail", description: "Aucun bail signé ne concerne vos lots confiés pour cette sélection." }}
        >
          {(leases) => (
            <Section title="Baux de vos lots">
              <DataTable caption="Baux de vos lots confiés" columns={columns} rows={leases.map((lease) => ({ key: lease.id, value: lease }))} />
            </Section>
          )}
        </PagedState>
      )}
    </>
  );
}
