"use client";

import { Building } from "lucide-react";
import Link from "next/link";
import { confieRoutes } from "@/features/confie/routes";
import { DataTable } from "@/features/confie/ui/DataTable";
import type { Column } from "@/features/confie/ui/DataTable";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Section } from "@/features/confie/ui/Section";
import { agencyAndMandant, formatAddress, formatOptionalDay, formatSurface, unitTypeLabel } from "../format";
import { AgencyFilter } from "../shared/AgencyFilter";
import { PagedState } from "../shared/PagedState";
import { useAgencyFilter } from "../shared/useAgencyFilter";
import type { OwnerUnit } from "./model";
import { useProperties } from "./queries";

export function coverage(unit: Pick<OwnerUnit, "coveredFrom" | "coveredUntil">): string {
  if (unit.coveredFrom === null) return "Non renseigné";
  return unit.coveredUntil === null ? `Depuis le ${formatOptionalDay(unit.coveredFrom)}` : `Du ${formatOptionalDay(unit.coveredFrom)} au ${formatOptionalDay(unit.coveredUntil)}`;
}

const columns: readonly Column<OwnerUnit>[] = [
  {
    id: "lot",
    header: "Lot",
    primary: true,
    cell: (unit) => (
      <Link href={confieRoutes.bien(unit.id)} className="underline-offset-2 hover:underline">
        {unit.reference}
      </Link>
    ),
  },
  { id: "bien", header: "Bien", cell: (unit) => `${unit.propertyName} · ${formatAddress(unit.address)}` },
  { id: "type", header: "Type", cell: (unit) => unitTypeLabel(unit.typeKey) },
  { id: "surface", header: "Surface", cell: (unit) => formatSurface(unit.surfaceHundredths) },
  { id: "mandat", header: "Mandat", cell: (unit) => agencyAndMandant(unit.agency.name, unit.mandantName) },
  { id: "couverture", header: "Couverture", cell: coverage },
];

export function PropertiesScreen() {
  const filter = useAgencyFilter();
  const list = useProperties(filter.agency, !filter.unknown);
  return (
    <>
      <PageHeader title="Mes biens" subtitle="Les lots que votre agence gère pour vous" />
      <AgencyFilter filter={filter} />
      {filter.unknown ? null : (
        <PagedState
          list={list}
          loadingLabel="Chargement de vos biens"
          failureTitle="Vos biens n’ont pas pu être chargés"
          empty={{ icon: Building, title: "Aucun bien confié", description: "Aucun lot n’est couvert par un mandat en cours ou récent pour cette sélection." }}
        >
          {(units) => (
            <Section title="Lots confiés">
              <DataTable caption="Lots confiés à votre agence" columns={columns} rows={units.map((unit) => ({ key: unit.id, value: unit }))} />
            </Section>
          )}
        </PagedState>
      )}
    </>
  );
}
