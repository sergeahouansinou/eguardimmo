"use client";

import { Button, Icon, StatCard } from "@eguardimmo/ui";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { monthName, plural } from "../data/dates";
import { lotTotalRent, rentState, sum } from "../data/derive";
import { useConfie } from "../data/queries";
import type { ConfieData } from "../data/schemas";
import { eur, percentOf } from "../data/money";
import { confieRoutes } from "../routes";
import { DataTable } from "../ui/DataTable";
import type { Column, TableRow } from "../ui/DataTable";
import { PageHeader } from "../ui/PageHeader";
import { RentStateBadge } from "../ui/parts";
import { Caption, Section, StatGrid } from "../ui/Section";
import { QueryBoundary } from "../ui/States";

export function MesBiensScreen() {
  const query = useConfie();
  return <QueryBoundary query={query}>{(data) => <MesBiens data={data} />}</QueryBoundary>;
}

function MesBiens({ data }: { data: ConfieData }) {
  const states = data.lots.map((lot) => ({ lot, state: rentState(lot, data.today) }));
  const called = sum(states.map(({ state }) => state.called));
  const collected = sum(states.map(({ state }) => state.collected));
  const overdue = states.flatMap(({ state }) => (state.kind === "overdue" ? [state] : []));
  const month = monthName(data.today.slice(0, 7));
  const address = data.lots[0]?.address ?? "";

  const columns: Column<(typeof states)[number]>[] = [
    { id: "lot", header: "Lot", primary: true, cell: ({ lot }) => <>{lot.label}<br /><Caption>{lot.kind}, {lot.surface} m²</Caption></> },
    { id: "address", header: "Adresse", cell: ({ lot }) => `${lot.address.split(",")[0] ?? lot.address}, ${lot.floorRank} étage` },
    { id: "tenant", header: "Locataire", cell: ({ lot }) => lot.tenant.name },
    { id: "rent", header: "Loyer charges comprises", align: "end", cell: ({ lot }) => eur(lotTotalRent(lot)) },
    { id: "collected", header: `Encaissé en ${month}`, align: "end", cell: ({ state }) => <span className={state.kind === "overdue" ? "font-semibold text-fg-danger" : undefined}>{eur(state.collected)}</span> },
    { id: "state", header: "État", cell: ({ state }) => <RentStateBadge state={state} /> },
    {
      id: "action",
      header: "Action",
      action: true,
      cell: ({ lot }) => (
        <Button variant="link" size="sm" asChild>
          <Link href={confieRoutes.bien(lot.id)} aria-label={`Voir la fiche, ${lot.label}`}>Voir la fiche</Link>
        </Button>
      ),
    },
  ];
  const rows: TableRow<(typeof states)[number]>[] = states.map((item) => ({ key: item.lot.id, value: item }));

  return (
    <>
      <PageHeader
        title="Mes biens"
        crumbs={[{ label: "Mon patrimoine" }, { label: "Mes biens" }]}
        subtitle={`${plural(data.lots.length, "lot")} au ${address}, gérés par ${data.agency.name}.`}
        actions={
          <Button variant="secondary" asChild>
            <Link href={confieRoutes.messageNouveau}><Icon icon={MessageSquare} />Écrire à l&apos;agence</Link>
          </Button>
        }
      />
      <StatGrid columns={3}>
        <StatCard label={`Loyers appelés, ${month}`} value={eur(called)}><Caption>{plural(data.lots.length, "lot loué", "lots loués")}</Caption></StatCard>
        <StatCard label={`Loyers encaissés, ${month}`} value={eur(collected)}><Caption>{percentOf(collected, called)} % des loyers appelés</Caption></StatCard>
        <StatCard label="Impayé" tone={overdue.length > 0 ? "danger" : "default"} value={eur(sum(overdue.map((state) => state.called - state.collected)))}>
          <Caption>{overdue.length === 0 ? "Aucun impayé" : `${plural(overdue.length, "lot")}, ${plural(Math.max(...overdue.map((state) => state.days)), "jour")} de retard`}</Caption>
        </StatCard>
      </StatGrid>
      <Section title={`Mes ${plural(data.lots.length, "lot")}`}>
        <DataTable caption="Liste de mes lots" columns={columns} rows={rows} />
        <p className="pt-2 text-caption text-fg-subtle">1 à {data.lots.length} sur {data.lots.length}</p>
      </Section>
    </>
  );
}
