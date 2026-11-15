"use client";

import { Badge, Button, Card, EmptyState, Pagination, Select, Tab, TabList, TabPanel, Tabs } from "@eguardimmo/ui";
import { Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { QueryState } from "@/components/ui/QueryState";
import { SearchField } from "@/components/ui/SearchField";
import { DataTable, Kpi, KpiGrid, LinkButton, PageFrame, usePagination } from "@/features/kit";
import { formatDate } from "@/features/shared/dates";
import { MANDANTS } from "@/features/shared/directory";
import { matchesQuery } from "@/lib/text";
import { CONTRACTORS } from "./contractors";
import { PRIORITY_LABELS, PRIORITY_TONES, STATUS_LABELS, STATUS_TONES } from "./labels";
import { useDevisList, useInterventions } from "./queries";
import { interventionStats, ownerLabel, sortInterventions, tabOf } from "./selectors";
import type { TabKey } from "./selectors";
import { PRIORITIES } from "./schemas";
import type { Devis, Intervention } from "./schemas";

const PAGE_SIZE = 10;

const ALL = "all";

const MANDANT_OPTIONS = [{ value: ALL, label: "Tous les mandants" }, ...MANDANTS.map((mandant) => ({ value: mandant.id, label: mandant.name }))];
const PRIORITY_OPTIONS = [{ value: ALL, label: "Toutes les priorités" }, ...PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] }))];
const CONTRACTOR_OPTIONS = [{ value: ALL, label: "Tous les intervenants" }, ...CONTRACTORS.map((item) => ({ value: item.name, label: item.name }))];

const EMPTY_TEXT: Record<TabKey, string> = {
  ouvertes: "Aucune intervention ouverte pour le moment.",
  terminees: "Aucune intervention terminée.",
  archivees: "Aucune intervention archivée.",
};

export function InterventionsPage() {
  const interventions = useInterventions();
  const devis = useDevisList();
  return (
    <PageFrame
      crumbs={[{ label: "Suivi" }, { label: "Interventions" }]}
      title="Interventions"
      description="Travaux et dépannages dans les biens sous mandat. Les urgences sont en tête."
      actions={
        <LinkButton href="/interventions/nouvelle" variant="primary">
          Nouvelle intervention
        </LinkButton>
      }
    >
      <QueryState query={interventions} label="Les interventions">
        {(items) => (
          <QueryState query={devis} label="Les devis">
            {(devisList) => <InterventionsContent items={items} devis={devisList} />}
          </QueryState>
        )}
      </QueryState>
    </PageFrame>
  );
}

function InterventionsContent({ items, devis }: { items: readonly Intervention[]; devis: readonly Devis[] }) {
  const [tab, setTab] = useState<TabKey>("ouvertes");
  const [search, setSearch] = useState("");
  const [mandant, setMandant] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [contractor, setContractor] = useState(ALL);

  const stats = interventionStats(items, devis);
  const counts = { ouvertes: 0, terminees: 0, archivees: 0 };
  items.forEach((item) => {
    counts[tabOf(item)] += 1;
  });

  const filtered = sortInterventions(
    items.filter(
      (item) =>
        tabOf(item) === tab &&
        (mandant === ALL || item.mandantId === mandant) &&
        (priority === ALL || item.priority === priority) &&
        (contractor === ALL || item.contractor === contractor) &&
        matchesQuery(search, item.subject, item.propertyLabel, ownerLabel(item)),
    ),
  );
  const pagination = usePagination(filtered, PAGE_SIZE);

  return (
    <>
      <KpiGrid columns={3}>
        <Kpi label="Interventions ouvertes" value={stats.openCount} hint={stats.openHint} />
        <Kpi label="Devis à soumettre" value={stats.pendingDevisCount} hint={stats.pendingDevisHint} />
        <Kpi label={`Terminées en ${stats.lastMonthLabel}`} value={stats.lastMonthCount} hint={stats.lastMonthHint} />
      </KpiGrid>
      <Card role="region" aria-label="Liste des interventions">
        <Tabs
          value={tab}
          defaultValue="ouvertes"
          onValueChange={(next) => {
            setTab(next as TabKey);
            pagination.setPage(1);
          }}
        >
          <TabList aria-label="État des interventions">
            <Tab value="ouvertes" count={counts.ouvertes}>
              Ouvertes
            </Tab>
            <Tab value="terminees" count={counts.terminees}>
              Terminées
            </Tab>
            <Tab value="archivees">Archivées</Tab>
          </TabList>
          <TabPanel value={tab} className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <SearchField
                label="Rechercher une intervention"
                placeholder="Sujet, bien"
                value={search}
                className="w-full sm:w-60"
                onChange={(event) => {
                  setSearch(event.target.value);
                  pagination.setPage(1);
                }}
              />
              <Select
                label="Mandant"
                hideLabel
                placeholder="Mandant"
                options={MANDANT_OPTIONS}
                value={mandant}
                className="w-full sm:w-48"
                onValueChange={(next) => {
                  setMandant(next);
                  pagination.setPage(1);
                }}
              />
              <Select
                label="Priorité"
                hideLabel
                placeholder="Priorité"
                options={PRIORITY_OPTIONS}
                value={priority}
                className="w-full sm:w-48"
                onValueChange={(next) => {
                  setPriority(next);
                  pagination.setPage(1);
                }}
              />
              <Select
                label="Intervenant"
                hideLabel
                placeholder="Intervenant"
                options={CONTRACTOR_OPTIONS}
                value={contractor}
                className="w-full sm:w-52"
                onValueChange={(next) => {
                  setContractor(next);
                  pagination.setPage(1);
                }}
              />
            </div>
            <DataTable
              caption="Interventions"
              rows={pagination.slice}
              getRowId={(row) => row.id}
              empty={
                <EmptyState icon={Wrench} title="Aucune intervention" description={search || mandant !== ALL || priority !== ALL || contractor !== ALL ? "Modifiez la recherche ou les filtres." : EMPTY_TEXT[tab]} />
              }
              columns={[
                {
                  id: "subject",
                  header: "Sujet",
                  role: "title",
                  cell: (row) => (
                    <Link href={`/interventions/${row.id}`} className="hover:underline">
                      {row.subject}
                    </Link>
                  ),
                },
                {
                  id: "property",
                  header: "Bien",
                  cell: (row) => (
                    <span className="flex flex-col">
                      <span>{row.propertyLabel}</span>
                      <span className="text-caption text-fg-subtle">{ownerLabel(row)}</span>
                    </span>
                  ),
                },
                { id: "contractor", header: "Intervenant", cell: (row) => row.contractor || "À désigner" },
                { id: "due", header: "Échéance", cell: (row) => (row.dueOn ? formatDate(row.dueOn) : "—") },
                {
                  id: "priority",
                  header: "Priorité",
                  cell: (row) => <Badge tone={PRIORITY_TONES[row.priority]}>{PRIORITY_LABELS[row.priority]}</Badge>,
                },
                {
                  id: "status",
                  header: "État",
                  cell: (row) => <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>,
                },
                {
                  id: "action",
                  header: "Action",
                  hideHeader: true,
                  role: "action",
                  cell: (row) => (
                    <Button variant="link" size="sm" asChild>
                      <Link href={`/interventions/${row.id}`} aria-label={`Ouvrir l'intervention ${row.subject}`}>
                        Ouvrir
                      </Link>
                    </Button>
                  ),
                },
              ]}
            />
            <Pagination
              page={pagination.page}
              pageSize={PAGE_SIZE}
              total={pagination.total}
              label="Pagination des interventions"
              onPageChange={pagination.setPage}
            />
          </TabPanel>
        </Tabs>
      </Card>
    </>
  );
}
