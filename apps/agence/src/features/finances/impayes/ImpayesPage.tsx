"use client";

import { Badge, Button, Chip, EmptyState, Icon, Pagination, Select, Tab, TabList, TabPanel, Tabs } from "@eguardimmo/ui";
import { CircleCheck, Download, BellRing } from "lucide-react";
import { useState } from "react";
import { QueryState } from "@/components/ui/QueryState";
import { SearchField } from "@/components/ui/SearchField";
import { SectionCard } from "@/components/ui/SectionCard";
import { DataTable, Kpi, KpiGrid, LinkButton, PageFrame, useNotify, usePagination } from "@/features/kit";
import type { Column } from "@/features/kit";
import { DEMO_TODAY, formatDate, periodOf } from "@/features/shared/dates";
import { formatMoney, formatMoneyExact } from "@/features/shared/money";
import { downloadCsv, toCsv } from "@/lib/csv";
import { matchesQuery } from "@/lib/text";
import { csvAmount, dateOrDash, monthOfPeriod, plural } from "../format";
import { useImpayes } from "../hooks";
import type { Impayes, UnpaidRow } from "../schemas";
import { FilterBar } from "../ui/FilterBar";
import { ReminderDialog } from "./ReminderDialog";

const TAB_IDS = ["tous", "moins", "plus"] as const;
type TabId = (typeof TAB_IDS)[number];

function isTabId(value: string): value is TabId {
  return TAB_IDS.some((id) => id === value);
}

function inTab(row: UnpaidRow, tab: TabId): boolean {
  if (tab === "moins") return row.overdueDays < 15;
  if (tab === "plus") return row.overdueDays >= 15;
  return true;
}

export function ImpayesPage() {
  const query = useImpayes();
  return (
    <QueryState query={query} label="Les impayés">
      {(data) => <Impayes data={data} />}
    </QueryState>
  );
}

function Impayes({ data }: { data: Impayes }) {
  const notify = useNotify();
  const [tab, setTab] = useState<TabId>("tous");
  const [search, setSearch] = useState("");
  const [mandant, setMandant] = useState("tous");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [reminderOpen, setReminderOpen] = useState(false);

  const filtered = data.rows.filter(
    (row) => inTab(row, tab) && (mandant === "tous" || row.mandantId === mandant) && (!urgentOnly || row.nextStep.urgent) && matchesQuery(search, row.tenantName, row.lotLabel),
  );
  const pagination = usePagination(filtered, 20);
  const chosen = data.rows.filter((row) => selected.has(row.lotId));

  const columns: Column<UnpaidRow>[] = [
    {
      id: "tenant",
      header: "Locataire",
      role: "title",
      cell: (row) => (
        <>
          <span className="block">{row.tenantName}</span>
          <span className="block text-caption font-normal text-fg-subtle">{row.lotLabel}</span>
        </>
      ),
    },
    { id: "mandant", header: "Mandant", cell: (row) => row.mandantName },
    { id: "due", header: "Échéance", cell: (row) => formatDate(row.dueOn) },
    { id: "remaining", header: "Reste dû", numeric: true, cell: (row) => <span className="font-semibold text-fg-danger">{formatMoneyExact(row.remainingMinor)}</span> },
    { id: "delay", header: "Retard", role: "status", cell: (row) => <Badge tone={row.overdueDays >= 15 ? "danger" : "warning"}>{plural(row.overdueDays, "jour", "jours")}</Badge> },
    { id: "last", header: "Dernière relance", cell: (row) => dateOrDash(row.lastReminderOn) },
    { id: "next", header: "Prochaine étape", cell: (row) => row.nextStep.label },
    {
      id: "action",
      header: "Action",
      role: "action",
      hideHeader: true,
      cell: (row) => (
        <LinkButton href={`/finances/impayes/${row.lotId}`} variant="ghost" size="sm">
          Ouvrir<span className="sr-only"> le dossier de {row.tenantName}</span>
        </LinkButton>
      ),
    },
  ];

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCsv = () => {
    const rows = filtered.map((row) => [row.tenantName, row.lotLabel, row.mandantName, formatDate(row.dueOn), csvAmount(row.remainingMinor), String(row.overdueDays), dateOrDash(row.lastReminderOn), row.nextStep.label]);
    downloadCsv("impayes.csv", toCsv(["Locataire", "Lot", "Mandant", "Échéance", "Reste dû", "Retard (jours)", "Dernière relance", "Prochaine étape"], rows));
    notify.success("Export téléchargé", plural(rows.length, "dossier exporté", "dossiers exportés"));
  };

  const relaunch = () => {
    if (chosen.length === 0) {
      notify.warning("Aucun dossier sélectionné", "Cochez au moins un impayé à relancer.");
      return;
    }
    setReminderOpen(true);
  };

  const counts = { tous: data.rows.length, moins: data.rows.filter((row) => inTab(row, "moins")).length, plus: data.rows.filter((row) => inTab(row, "plus")).length };

  return (
    <PageFrame
      crumbs={[{ label: "Finances" }, { label: "Impayés" }]}
      title="Impayés"
      description="Loyers et charges non réglés, classés par ancienneté. Chaque relance envoyée est tracée dans le dossier."
      actions={
        <>
          <Button variant="secondary" onClick={exportCsv}>
            <Icon icon={Download} />
            Exporter
          </Button>
          <Button onClick={relaunch}>
            <Icon icon={BellRing} />
            Relancer la sélection
          </Button>
        </>
      }
    >
      <KpiGrid columns={3}>
        <Kpi label="Total impayé" value={formatMoney(data.totalMinor)} tone={data.totalMinor > 0 ? "danger" : "default"} hint={`${plural(data.rows.length, "dossier", "dossiers")}, ${plural(data.mandantsCount, "mandant", "mandants")}`} />
        <Kpi label="Plus de 20 jours" value={formatMoney(data.over20Minor)} hint={data.over20Label} />
        <Kpi label={`Relances en ${monthOfPeriod(periodOf(DEMO_TODAY))}`} value={String(data.remindersThisMonth)} hint={`sur ${plural(data.remindersCases, "dossier", "dossiers")}`} />
      </KpiGrid>
      <SectionCard title="Liste des impayés">
        <Tabs
          value={tab}
          defaultValue="tous"
          onValueChange={(value) => {
            if (isTabId(value)) setTab(value);
          }}
        >
          <TabList aria-label="Filtrer les impayés par ancienneté">
            <Tab value="tous" count={counts.tous}>
              Tous
            </Tab>
            <Tab value="moins" count={counts.moins}>
              Moins de 15 jours
            </Tab>
            <Tab value="plus" count={counts.plus}>
              Plus de 15 jours
            </Tab>
          </TabList>
          <FilterBar>
            <SearchField label="Rechercher un locataire ou un lot" placeholder="Locataire, lot" value={search} onChange={(event) => { setSearch(event.target.value); }} />
            <Select label="Mandant" hideLabel placeholder="Mandant : Tous" options={[{ value: "tous", label: "Tous les mandants" }, ...data.mandants]} value={mandant} onValueChange={setMandant} />
            <Chip pressed={urgentOnly} onClick={() => { setUrgentOnly((current) => !current); }}>
              Mise en demeure à envoyer
            </Chip>
          </FilterBar>
          <TabPanel value={tab} className="flex flex-col gap-3">
            <DataTable
              caption="Liste des impayés"
              rows={pagination.slice}
              getRowId={(row) => row.lotId}
              columns={columns}
              selection={{
                selected,
                rowLabel: (row) => `Sélectionner ${row.tenantName}, ${row.lotLabel}`,
                onToggle: toggle,
                onToggleAll: (all) => {
                  setSelected(all ? new Set(filtered.map((row) => row.lotId)) : new Set());
                },
              }}
              empty={
                <EmptyState
                  icon={CircleCheck}
                  title={data.rows.length === 0 ? "Aucun impayé" : "Aucun impayé ne correspond"}
                  description={data.rows.length === 0 ? "Tous les loyers appelés sont encaissés." : "Modifiez la recherche ou les filtres pour afficher d'autres dossiers."}
                >
                  {data.rows.length === 0 ? <LinkButton href="/finances/encaissements">Voir les encaissements</LinkButton> : null}
                </EmptyState>
              }
            />
            {filtered.length > 0 ? <Pagination page={pagination.page} pageSize={pagination.pageSize} total={pagination.total} onPageChange={pagination.setPage} label="Pagination des impayés" /> : null}
          </TabPanel>
        </Tabs>
      </SectionCard>
      <ReminderDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        lotIds={chosen.map((row) => row.lotId)}
        recipients={chosen.map((row) => row.tenantName)}
        onSent={() => {
          setSelected(new Set());
        }}
      />
    </PageFrame>
  );
}
