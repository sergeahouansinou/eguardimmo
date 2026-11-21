"use client";

import { Button } from "@eguardimmo/ui";
import Link from "next/link";
import { confieRoutes } from "@/features/confie/routes";
import { DataList } from "@/features/confie/ui/DataList";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { Section } from "@/features/confie/ui/Section";
import { agencyLabel, formatAddress, formatFloor, formatSurface, unitTypeLabel } from "../format";
import { FailureNotice, Loading } from "../screens/FailureNotice";
import { useProperty } from "./queries";
import { coverage } from "./PropertiesScreen";

export function PropertyScreen({ id }: { id: string }) {
  const query = useProperty(id);
  const unit = query.data;
  if (unit === undefined) {
    return query.isError ? (
      <>
        <PageHeader title="Fiche du bien" crumbs={[{ label: "Mes biens", href: confieRoutes.biens }, { label: "Fiche du bien" }]} />
        <FailureNotice title="Ce bien n’a pas pu être chargé" error={query.error} onRetry={() => void query.refetch()} />
        <div>
          <Button variant="secondary" asChild>
            <Link href={confieRoutes.biens}>Retour à mes biens</Link>
          </Button>
        </div>
      </>
    ) : (
      <Loading label="Chargement du bien" />
    );
  }
  return (
    <>
      <PageHeader
        title={`Lot ${unit.reference}`}
        subtitle={unit.propertyName}
        crumbs={[{ label: "Mes biens", href: confieRoutes.biens }, { label: `Lot ${unit.reference}` }]}
      />
      <Section title="Description du lot">
        <DataList
          width="lg"
          items={[
            { label: "Bien", value: unit.propertyName },
            { label: "Adresse", value: formatAddress(unit.address) },
            { label: "Type", value: unitTypeLabel(unit.typeKey) },
            { label: "Étage", value: formatFloor(unit.floor) },
            { label: "Surface", value: formatSurface(unit.surfaceHundredths) },
          ]}
        />
      </Section>
      <Section title="Gestion confiée">
        <DataList
          width="lg"
          items={[
            { label: "Agence", value: agencyLabel(unit.agency.name) },
            { label: "Mandant", value: unit.mandantName ?? "Non renseigné" },
            { label: "Couverture du mandat", value: coverage(unit) },
          ]}
        />
      </Section>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" asChild>
          <Link href={confieRoutes.baux}>Voir les baux</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href={confieRoutes.interventions}>Voir les interventions</Link>
        </Button>
      </div>
    </>
  );
}
