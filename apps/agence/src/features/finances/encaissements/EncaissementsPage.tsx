"use client";

import { Button, Chip, EmptyState, Icon, Pagination, Select, Tab, TabList, TabPanel, Tabs } from "@eguardimmo/ui";
import { Inbox, Download, Plus } from "lucide-react";
import { useState } from "react";
import { QueryState } from "@/components/ui/QueryState";
import { SearchField } from "@/components/ui/SearchField";
import { SectionCard } from "@/components/ui/SectionCard";
import { DataTable, Kpi, KpiGrid, LinkButton, PageFrame, useNotify, usePagination } from "@/features/kit";
import type { Column } from "@/features/kit";
import { downloadCsv, toCsv } from "@/lib/csv";
import { matchesQuery } from "@/lib/text";
import { formatDate } from "@/features/shared/dates";
import { formatMoney, formatMoneyExact, sum } from "@/features/shared/money";
import { CURRENT_PERIOD } from "../server/model";
import { MODE_LABELS, csvAmount, monthOfPeriod, percentOf, plural } from "../format";
import { useEncaissements } from "../hooks";
import type { Encaissements, PaymentRow } from "../schemas";
import { PaymentStatusBadge } from "../ui/StatusBadges";
import { FilterBar } from "../ui/FilterBar";
import { PaymentDialog } from "./PaymentDialog";

const TAB_IDS = ["recus", "a_rapprocher", "rejetes"] as const;
type TabId = (typeof TAB_IDS)[number];

function isTabId(value: string): value is TabId {
  return TAB_IDS.some((id) => id === value);
}

const MODE_OPTIONS = [{ value: "tous", label: "Tous" }, ...Object.entries(MODE_LABELS).map(([value, label]) => ({ value, label }))];

export function EncaissementsPage() {
  const [period, setPeriod] = useState(CURRENT_PERIOD);
  const query = useEncaissements(period);
  return (
    <QueryState query={query} label="Les encaissements">
      {(data) => <Encaissements data={data} period={period} onPeriodChange={setPeriod} />}
    </QueryState>
  );
}

function inTab(row: PaymentRow, tab: TabId): boolean {
  if (tab === "rejetes") return row.status === "rejete";
  if (tab === "a_rapprocher") return row.status === "a_rapprocher";
  return row.status !== "rejete";
}

function Encaissements({ data, period, onPeriodChange }: { data: Encaissements; period: string; onPeriodChange: (period: string) => void }) {
  const notify = useNotify();
  const [tab, setTab] = useState<TabId>("recus");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("tous");
  const [mandant, setMandant] = useState("tous");
  const [toReconcile, setToReconcile] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = { recus: data.payments.filter((row) => inTab(row, "recus")).length, a_rapprocher: data.payments.filter((row) => inTab(row, "a_rapprocher")).length, rejetes: data.payments.filter((row) => inTab(row, "rejetes")).length };
  const filtered = data.payments.filter(
    (row) =>
      inTab(row, tab) &&
      (!toReconcile || row.status === "a_rapprocher") &&
      (mode === "tous" || row.mode === mode) &&
      (mandant === "tous" || row.mandantId === mandant) &&
      matchesQuery(search, row.tenantName, row.lotLabel),
  );
  const pagination = usePagination(filtered, 15);
  const month = monthOfPeriod(period);

  const columns: Column<PaymentRow>[] = [
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
    { id: "date", header: "Date", cell: (row) => formatDate(row.receivedOn) },
    { id: "mandant", header: "Mandant", cell: (row) => row.mandantName },
    { id: "mode", header: "Mode", cell: (row) => MODE_LABELS[row.mode] },
    { id: "amount", header: "Montant", numeric: true, cell: (row) => formatMoneyExact(row.amountMinor) },
    { id: "fee", header: "Honoraires", numeric: true, cell: (row) => formatMoneyExact(row.feeMinor) },
    { id: "status", header: "État", role: "status", cell: (row) => <PaymentStatusBadge status={row.status} /> },
    {
      id: "action",
      header: "Action",
      role: "action",
      hideHeader: true,
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpenId(row.id);
          }}
        >
          Ouvrir
        </Button>
      ),
    },
  ];

  const exportCsv = () => {
    const rows = filtered.map((row) => [row.tenantName, row.lotLabel, formatDate(row.receivedOn), row.mandantName, MODE_LABELS[row.mode], csvAmount(row.amountMinor), csvAmount(row.feeMinor), row.status === "rejete" ? "Rejeté" : row.status === "a_rapprocher" ? "À rapprocher" : "Rapproché"]);
    downloadCsv(`encaissements-${period}.csv`, toCsv(["Locataire", "Lot", "Date", "Mandant", "Mode", "Montant", "Honoraires", "État"], rows));
    notify.success("Export téléchargé", plural(rows.length, "encaissement exporté", "encaissements exportés"));
  };

  const empty = (
    <EmptyState
      icon={Inbox}
      title="Aucun encaissement"
      description={data.payments.length === 0 ? "Aucun paiement n'a été saisi sur cette période." : "Aucun paiement ne correspond à ces filtres."}
    />
  );

  return (
    <PageFrame
      crumbs={[{ label: "Finances" }, { label: "Encaissements" }]}
      title="Encaissements"
      description="Loyers et charges reçus de vos locataires, sur le compte des mandants. Les honoraires sont retenus à chaque encaissement."
      actions={
        <>
          <Button variant="secondary" onClick={exportCsv}>
            <Icon icon={Download} />
            Exporter
          </Button>
          <LinkButton href="/finances/encaissements/nouveau" variant="primary">
            <Icon icon={Plus} />
            Saisir un paiement
          </LinkButton>
        </>
      }
    >
      <KpiGrid columns={3}>
        <Kpi label={`Encaissé en ${month}`} value={formatMoney(data.collectedMinor)} hint={`sur ${formatMoney(data.calledMinor)} appelés · ${String(percentOf(data.collectedMinor, data.calledMinor))} %`} />
        <Kpi label="Honoraires retenus" value={formatMoneyExact(data.feeMinor)} hint={data.rateLabel} />
        <Kpi label="Reste à encaisser" value={formatMoney(data.remainingMinor)} tone={data.remainingMinor > 0 ? "danger" : "default"} hint={plural(data.unpaidCount, "locataire", "locataires")} />
      </KpiGrid>
      <SectionCard title="Liste des encaissements">
        <Tabs
          value={tab}
          defaultValue="recus"
          onValueChange={(value) => {
            if (isTabId(value)) setTab(value);
          }}
        >
          <TabList aria-label="Filtrer les encaissements">
            <Tab value="recus" count={counts.recus}>
              Reçus
            </Tab>
            <Tab value="a_rapprocher" count={counts.a_rapprocher}>
              À rapprocher
            </Tab>
            <Tab value="rejetes" {...(counts.rejetes > 0 ? { count: counts.rejetes } : {})}>
              Rejetés
            </Tab>
          </TabList>
          <FilterBar>
            <SearchField label="Rechercher un locataire ou un lot" placeholder="Locataire, lot" value={search} onChange={(event) => { setSearch(event.target.value); }} />
            <Select label="Période" hideLabel placeholder="Période" options={data.periods} value={period} onValueChange={onPeriodChange} />
            <Select label="Mode de paiement" hideLabel placeholder="Mode : Tous" options={MODE_OPTIONS} value={mode} onValueChange={setMode} />
            <Select label="Mandant" hideLabel placeholder="Mandant : Tous" options={[{ value: "tous", label: "Tous les mandants" }, ...data.mandants]} value={mandant} onValueChange={setMandant} />
            <Chip pressed={toReconcile} onClick={() => { setToReconcile((current) => !current); }}>
              À rapprocher
            </Chip>
          </FilterBar>
          <TabPanel value={tab} className="flex flex-col gap-3">
            <DataTable
              caption="Liste des encaissements"
              rows={pagination.slice}
              getRowId={(row) => row.id}
              columns={columns}
              empty={empty}
              {...(filtered.length > 0 && tab !== "rejetes" ? { footer: { amount: formatMoneyExact(sum(filtered.map((row) => row.amountMinor))), fee: formatMoneyExact(sum(filtered.map((row) => row.feeMinor))) } } : {})}
            />
            {filtered.length > 0 ? <Pagination page={pagination.page} pageSize={pagination.pageSize} total={pagination.total} onPageChange={pagination.setPage} label="Pagination des encaissements" /> : null}
          </TabPanel>
        </Tabs>
      </SectionCard>
      <PaymentDialog
        payment={data.payments.find((row) => row.id === openId) ?? null}
        onClose={() => {
          setOpenId(null);
        }}
      />
    </PageFrame>
  );
}
