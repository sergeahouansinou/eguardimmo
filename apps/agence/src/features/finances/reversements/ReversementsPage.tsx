"use client";

import { Button, Chip, EmptyState, Icon, Pagination, Select, Tab, TabList, TabPanel, Tabs } from "@eguardimmo/ui";
import { Landmark, Download, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionAlert } from "@/components/ui/ActionAlert";
import { QueryState } from "@/components/ui/QueryState";
import { SearchField } from "@/components/ui/SearchField";
import { SectionCard } from "@/components/ui/SectionCard";
import { DataTable, Kpi, KpiGrid, LinkButton, PageFrame, useNotify, usePagination } from "@/features/kit";
import type { Column } from "@/features/kit";
import { formatDate, formatPeriod } from "@/features/shared/dates";
import { messageOf } from "@/features/shared/errors";
import { formatMoneyExact, sum } from "@/features/shared/money";
import { downloadCsv, toCsv } from "@/lib/csv";
import { matchesQuery } from "@/lib/text";
import { csvAmount, joinLabels, plural } from "../format";
import { usePrepareLot, useReversements } from "../hooks";
import type { HistoryRow, Reversements, ReversementRow } from "../schemas";
import { FilterBar } from "../ui/FilterBar";
import { ReversementStatusBadge } from "../ui/StatusBadges";

const TAB_IDS = ["a_reverser", "reverses", "bloques"] as const;
type TabId = (typeof TAB_IDS)[number];

function isTabId(value: string): value is TabId {
  return TAB_IDS.some((id) => id === value);
}

const detailLink = (mandantId: string, name: string) => (
  <LinkButton href={`/finances/reversements/${mandantId}`} variant="ghost" size="sm">
    Détail<span className="sr-only"> du reversement de {name}</span>
  </LinkButton>
);

export function ReversementsPage() {
  const query = useReversements();
  return (
    <QueryState query={query} label="Les reversements">
      {(data) => <ReversementsContent data={data} />}
    </QueryState>
  );
}

function ReversementsContent({ data }: { data: Reversements }) {
  const router = useRouter();
  const notify = useNotify();
  const prepare = usePrepareLot();
  const [tab, setTab] = useState<TabId>("a_reverser");
  const [search, setSearch] = useState("");
  const [renewalOnly, setRenewalOnly] = useState(false);
  const [chosenPeriod, setChosenPeriod] = useState<string | null>(null);

  const period = chosenPeriod ?? (tab === "reverses" ? "tous" : data.period);
  const periods = [{ value: "tous", label: "Toutes les périodes" }, ...[...new Set([data.period, ...data.history.map((row) => row.period)])].sort().reverse().map((value) => ({ value, label: formatPeriod(value) }))];
  const match = (name: string, renewal: boolean) => matchesQuery(search, name) && (!renewalOnly || renewal);

  const toPay = data.rows.filter((row) => row.status === "a_reverser" && match(row.name, row.mandateRenewal) && (period === "tous" || period === data.period));
  const blocked = data.rows.filter((row) => row.status === "bloque" && match(row.name, row.mandateRenewal) && (period === "tous" || period === data.period));
  const history = data.history.filter((row) => match(row.name, row.mandateRenewal) && (period === "tous" || row.period === period));
  const counts = { a_reverser: data.rows.filter((row) => row.status === "a_reverser").length, reverses: data.history.length, bloques: data.rows.filter((row) => row.status === "bloque").length };
  const payRows = tab === "bloques" ? blocked : toPay;
  const payPagination = usePagination(payRows, 12);
  const historyPagination = usePagination(history, 12);
  const pagination = tab === "reverses" ? historyPagination : payPagination;

  const allRows = data.rows;
  const toPayTotal = sum(data.rows.filter((row) => row.status === "a_reverser").map((row) => row.netMinor));
  const totalFees = sum(allRows.map((row) => row.feeMinor));

  const columns: Column<ReversementRow>[] = [
    {
      id: "mandant",
      header: "Mandant",
      role: "title",
      cell: (row) => (
        <>
          <span className="block">{row.name}</span>
          <span className="block text-caption font-normal text-fg-subtle">{row.kind}</span>
        </>
      ),
    },
    { id: "lots", header: "Lots", numeric: true, cell: (row) => String(row.lots) },
    { id: "collected", header: "Encaissé", numeric: true, cell: (row) => formatMoneyExact(row.collectedMinor) },
    { id: "fee", header: "Honoraires", numeric: true, cell: (row) => formatMoneyExact(row.feeMinor) },
    { id: "net", header: "À reverser", numeric: true, cell: (row) => formatMoneyExact(row.netMinor) },
    { id: "iban", header: "Compte", cell: (row) => `IBAN •••• ${row.ibanLast4}` },
    { id: "date", header: "Date prévue", cell: (row) => formatDate(row.scheduledOn) },
    { id: "status", header: "État", role: "status", cell: (row) => <ReversementStatusBadge row={row} /> },
    { id: "action", header: "Action", role: "action", hideHeader: true, cell: (row) => detailLink(row.mandantId, row.name) },
  ];

  const historyColumns: Column<HistoryRow>[] = [
    {
      id: "mandant",
      header: "Mandant",
      role: "title",
      cell: (row) => (
        <>
          <span className="block">{row.name}</span>
          <span className="block text-caption font-normal text-fg-subtle">{row.kind}</span>
        </>
      ),
    },
    { id: "period", header: "Période", cell: (row) => formatPeriod(row.period) },
    { id: "lots", header: "Lots", numeric: true, cell: (row) => String(row.lots) },
    { id: "collected", header: "Encaissé", numeric: true, cell: (row) => formatMoneyExact(row.collectedMinor) },
    { id: "fee", header: "Honoraires", numeric: true, cell: (row) => formatMoneyExact(row.feeMinor) },
    { id: "net", header: "Reversé", numeric: true, cell: (row) => formatMoneyExact(row.netMinor) },
    { id: "iban", header: "Compte", cell: (row) => `IBAN •••• ${row.ibanLast4}` },
    { id: "date", header: "Date", cell: (row) => formatDate(row.paidOn) },
    { id: "status", header: "État", role: "status", cell: () => <ReversementStatusBadge row={{ status: "reverse" }} /> },
    { id: "action", header: "Action", role: "action", hideHeader: true, cell: (row) => detailLink(row.mandantId, row.name) },
  ];

  const exportCsv = () => {
    const lines =
      tab === "reverses"
        ? history.map((row) => [row.name, formatPeriod(row.period), String(row.lots), csvAmount(row.collectedMinor), csvAmount(row.feeMinor), csvAmount(row.netMinor), `•••• ${row.ibanLast4}`, formatDate(row.paidOn)])
        : (tab === "bloques" ? blocked : toPay).map((row) => [row.name, formatPeriod(data.period), String(row.lots), csvAmount(row.collectedMinor), csvAmount(row.feeMinor), csvAmount(row.netMinor), `•••• ${row.ibanLast4}`, formatDate(row.scheduledOn)]);
    downloadCsv(`reversements-${tab}.csv`, toCsv(["Mandant", "Période", "Lots", "Encaissé", "Honoraires", "Montant", "Compte", "Date"], lines));
    notify.success("Export téléchargé", plural(lines.length, "ligne exportée", "lignes exportées"));
  };

  const prepareLot = () => {
    prepare.mutate(undefined, {
      onSuccess: () => {
        router.push("/finances/reversements/lot");
      },
      onError: (error) => {
        notify.error("Le lot n'a pas pu être préparé", messageOf(error));
      },
    });
  };

  const lotLabel = data.batchStatus === "valide" ? "Voir le lot transmis" : data.batchStatus === "brouillon" ? "Reprendre le lot de virements" : "Préparer le lot de virements";

  return (
    <PageFrame
      crumbs={[{ label: "Finances" }, { label: "Reversements" }]}
      title="Reversements"
      description="Loyers de novembre à reverser à vos mandants, honoraires déduits. Les virements partent le 5 du mois suivant."
      actions={
        <>
          <Button variant="secondary" onClick={exportCsv}>
            <Icon icon={Download} />
            Exporter
          </Button>
          <Button loading={prepare.isPending} onClick={prepareLot}>
            <Icon icon={Send} />
            {lotLabel}
          </Button>
        </>
      }
    >
      {data.unpaid.count > 0 ? (
        <ActionAlert
          tone="info"
          title={`${plural(data.unpaid.count, "loyer impayé n'est", "loyers impayés ne sont")} pas dans ce lot`}
          action={
            <LinkButton href="/finances/impayes" size="sm">
              Voir les impayés
            </LinkButton>
          }
        >
          {`${joinLabels(data.unpaid.labels)} : ${formatMoneyExact(data.unpaid.totalMinor)}. Ils seront reversés après encaissement, avec les honoraires correspondants.`}
        </ActionAlert>
      ) : null}
      <KpiGrid columns={3}>
        <Kpi label="À reverser" value={formatMoneyExact(toPayTotal)} hint={`${plural(counts.a_reverser, "mandant", "mandants")}, le ${formatDate(data.executionOn)}`} />
        <Kpi label="Honoraires retenus" value={formatMoneyExact(totalFees)} hint={data.rateLabel} />
        <Kpi
          label="Dernier lot"
          value={data.lastBatch ? formatDate(data.lastBatch.executedOn) : "—"}
          hint={data.lastBatch ? `${data.lastBatch.periodLabel}, ${plural(data.lastBatch.count, "virement", "virements")} ${data.lastBatch.executed ? "exécutés" : "transmis"}` : "Aucun lot transmis"}
        />
      </KpiGrid>
      <SectionCard title="Liste des reversements">
        <Tabs
          value={tab}
          defaultValue="a_reverser"
          onValueChange={(value) => {
            if (isTabId(value)) {
              setTab(value);
              setChosenPeriod(null);
            }
          }}
        >
          <TabList aria-label="Filtrer les reversements">
            <Tab value="a_reverser" count={counts.a_reverser}>
              À reverser
            </Tab>
            <Tab value="reverses" count={counts.reverses}>
              Reversés
            </Tab>
            <Tab value="bloques" {...(counts.bloques > 0 ? { count: counts.bloques } : {})}>
              Bloqués
            </Tab>
          </TabList>
          <FilterBar>
            <SearchField label="Rechercher un mandant" placeholder="Mandant" value={search} onChange={(event) => { setSearch(event.target.value); }} />
            <Select label="Période" hideLabel placeholder="Période" options={periods} value={period} onValueChange={setChosenPeriod} />
            <Chip pressed={renewalOnly} onClick={() => { setRenewalOnly((current) => !current); }}>
              Mandat à renouveler
            </Chip>
          </FilterBar>
          <TabPanel value={tab} className="flex flex-col gap-3">
            {tab === "reverses" ? (
              <DataTable
                caption="Reversements effectués"
                rows={historyPagination.slice}
                getRowId={(row) => row.id}
                columns={historyColumns}
                empty={<EmptyState icon={Landmark} title="Aucun reversement" description="Aucun reversement effectué ne correspond à ces filtres." />}
              />
            ) : (
              <DataTable
                caption={tab === "bloques" ? "Reversements bloqués" : "Reversements à effectuer"}
                rows={payPagination.slice}
                getRowId={(row) => row.mandantId}
                columns={columns}
                empty={
                  <EmptyState
                    icon={Landmark}
                    title={tab === "bloques" ? "Aucun reversement bloqué" : "Aucun reversement à effectuer"}
                    description={tab === "bloques" ? "Vous pouvez bloquer le reversement d'un mandant depuis sa fiche de reversement." : "Tous les reversements de la période sont effectués ou bloqués."}
                  />
                }
                {...(tab === "a_reverser" && toPay.length > 0
                  ? {
                      footer: {
                        lots: String(sum(toPay.map((row) => row.lots))),
                        collected: formatMoneyExact(sum(toPay.map((row) => row.collectedMinor))),
                        fee: formatMoneyExact(sum(toPay.map((row) => row.feeMinor))),
                        net: formatMoneyExact(sum(toPay.map((row) => row.netMinor))),
                      },
                    }
                  : {})}
              />
            )}
            {pagination.total > 0 ? <Pagination page={pagination.page} pageSize={pagination.pageSize} total={pagination.total} onPageChange={pagination.setPage} label="Pagination des reversements" /> : null}
          </TabPanel>
        </Tabs>
      </SectionCard>
    </PageFrame>
  );
}
