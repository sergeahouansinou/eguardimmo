"use client";

import { Alert, Badge, Button, StatCard, Tab, TabList, TabPanel, Tabs } from "@eguardimmo/ui";
import Link from "next/link";
import { useState } from "react";
import { formatDate, plural } from "../data/dates";
import { lotLabel, pendingQuotes, sum } from "../data/derive";
import { useConfie } from "../data/queries";
import type { ConfieData, Intervention } from "../data/schemas";
import { eur, eurFixed } from "../data/money";
import { confieRoutes } from "../routes";
import { DataTable } from "../ui/DataTable";
import type { Column, TableRow } from "../ui/DataTable";
import { PageHeader } from "../ui/PageHeader";
import { INTERVENTION_STATUS } from "../ui/parts";
import { Caption, Section, StatGrid } from "../ui/Section";
import { EmptyLine, QueryBoundary } from "../ui/States";

export function InterventionsScreen() {
  const query = useConfie();
  return <QueryBoundary query={query}>{(data) => <Interventions data={data} />}</QueryBoundary>;
}

export function interventionDate(item: Intervention): string {
  if (item.status === "done" && item.doneOn) return `Terminée le ${formatDate(item.doneOn)}`;
  if (!item.quote) return `Signalée le ${formatDate(item.reportedOn)}`;
  if (item.status === "quote_accepted") return `Passage prévu le ${formatDate(item.quote.proposedOn)}`;
  if (item.status === "quote_refused") return `Devis refusé le ${formatDate(item.decision?.decidedOn ?? item.quote.receivedOn)}`;
  return `Devis du ${formatDate(item.quote.receivedOn)}`;
}

function Interventions({ data }: { data: ConfieData }) {
  const [tab, setTab] = useState("toutes");
  const pending = pendingQuotes(data);
  const done = data.interventions.filter((item) => item.status === "done");
  const threshold = data.mandate.worksThreshold;
  const first = pending[0];
  const filters: Record<string, readonly Intervention[]> = {
    toutes: data.interventions,
    "a-valider": pending,
    terminees: done,
  };

  const columns: Column<Intervention>[] = [
    { id: "title", header: "Intervention", primary: true, cell: (item) => <>{item.title}<br /><Caption>{item.category}</Caption></> },
    { id: "lot", header: "Lot", cell: (item) => lotLabel(data, item.lotId) },
    { id: "artisan", header: "Artisan", cell: (item) => item.artisan },
    { id: "amount", header: "Montant TTC", align: "end", cell: (item) => eurFixed(item.totalTtc) },
    { id: "date", header: "Date", cell: interventionDate },
    { id: "state", header: "État", cell: (item) => <Badge tone={INTERVENTION_STATUS[item.status].tone}>{INTERVENTION_STATUS[item.status].label}</Badge> },
    {
      id: "action",
      header: "Action",
      action: true,
      cell: (item) => (
        <Button variant="link" size="sm" asChild>
          <Link
            href={item.status === "quote_pending" ? confieRoutes.devis(item.id) : confieRoutes.intervention(item.id)}
            aria-label={`${item.status === "quote_pending" ? "Examiner" : "Voir le suivi"} : ${item.title}`}
          >
            {item.status === "quote_pending" ? "Examiner" : "Voir le suivi"}
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Interventions"
        crumbs={[{ label: "Échanges" }, { label: "Interventions" }]}
        subtitle={`Travaux et réparations sur vos lots, suivis par l'agence. Au-delà de ${eur(threshold)} TTC, votre accord est demandé.`}
      />
      {first?.quote ? (
        <Alert tone="warning" title={pending.length > 1 ? `${plural(pending.length, "devis attend", "devis attendent")} votre accord` : "Un devis attend votre accord"}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>{first.category}, {lotLabel(data, first.lotId)} : {eurFixed(first.totalTtc)} TTC. À valider avant le {formatDate(first.quote.decideBefore)} pour planifier l&apos;intervention.</span>
            <Button variant="secondary" size="sm" asChild><Link href={confieRoutes.devis(first.id)}>Examiner le devis</Link></Button>
          </span>
        </Alert>
      ) : null}
      <StatGrid columns={3}>
        <StatCard label="Devis à valider" value={String(pending.length)}><Caption>{eurFixed(sum(pending.map((item) => item.totalTtc)))} TTC au total</Caption></StatCard>
        <StatCard label={`Terminées en ${data.today.slice(0, 4)}`} value={String(done.length)}><Caption>{eurFixed(sum(done.map((item) => item.totalTtc)))} TTC imputés sur un reversement</Caption></StatCard>
        <StatCard label="Seuil d'accord" value={eur(threshold)}><Caption>TTC par intervention, selon le mandat</Caption></StatCard>
      </StatGrid>
      <Section title="Suivi des interventions">
        <Tabs value={tab} defaultValue="toutes" onValueChange={setTab}>
          <TabList aria-label="Filtrer les interventions">
            <Tab value="toutes" count={data.interventions.length}>Toutes</Tab>
            <Tab value="a-valider" count={pending.length}>À valider</Tab>
            <Tab value="terminees" count={done.length}>Terminées</Tab>
          </TabList>
          {Object.entries(filters).map(([key, items]) => (
            <TabPanel key={key} value={key} className="flex flex-col gap-2 pt-2">
              {items.length === 0 ? <EmptyLine>Aucune intervention dans cette catégorie.</EmptyLine> : (
                <DataTable caption="Interventions" columns={columns} rows={items.map<TableRow<Intervention>>((item) => ({ key: item.id, value: item }))} />
              )}
              <p className="text-caption text-fg-subtle">{items.length === 0 ? "0 intervention" : `1 à ${String(items.length)} sur ${String(items.length)}`}</p>
            </TabPanel>
          ))}
        </Tabs>
      </Section>
    </>
  );
}
