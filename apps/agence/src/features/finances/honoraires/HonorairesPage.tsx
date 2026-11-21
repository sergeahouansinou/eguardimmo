"use client";

import { Badge, Button, EmptyState, Icon, Tab, TabList, TabPanel, Tabs } from "@eguardimmo/ui";
import { Receipt, Download, Percent } from "lucide-react";
import { useState } from "react";
import { ActionAlert } from "@/components/ui/ActionAlert";
import { QueryState } from "@/components/ui/QueryState";
import { SectionCard } from "@/components/ui/SectionCard";
import { DataTable, DetailList, Kpi, KpiGrid, LinkButton, PageFrame, SummaryLines, useNotify } from "@/features/kit";
import type { Column } from "@/features/kit";
import { formatDate } from "@/features/shared/dates";
import { formatMoney, formatMoneyExact } from "@/features/shared/money";
import { downloadCsv, toCsv } from "@/lib/csv";
import { FEE_PERIODS, csvAmount, plural, rateText, rateTtc } from "../format";
import { useHonoraires } from "../hooks";
import type { Honoraires } from "../schemas";
import { FeeDetailDialog } from "./FeeDetailDialog";

type FeeRow = Honoraires["rows"][number];

const CURRENT = FEE_PERIODS[0].value;

function isPeriod(value: string): boolean {
  return FEE_PERIODS.some((item) => item.value === value);
}

export function HonorairesPage() {
  const [period, setPeriod] = useState<string>(CURRENT);
  const query = useHonoraires(period);
  return (
    <QueryState query={query} label="Les honoraires">
      {(data) => <HonorairesContent data={data} period={period} onPeriodChange={setPeriod} />}
    </QueryState>
  );
}

function HonorairesContent({ data, period, onPeriodChange }: { data: Honoraires; period: string; onPeriodChange: (period: string) => void }) {
  const notify = useNotify();
  const [openId, setOpenId] = useState<string | null>(null);
  const yearly = period === "2026";
  const columns: Column<FeeRow>[] = [
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
    { id: "mandate", header: "Mandat", cell: (row) => row.mateRef },
    { id: "rate", header: "Taux", cell: (row) => rateTtc(row.rateBp) },
    { id: "collected", header: "Loyers encaissés", numeric: true, cell: (row) => formatMoneyExact(row.collectedMinor) },
    { id: "fee", header: "Honoraires TTC", numeric: true, cell: (row) => formatMoneyExact(row.feeMinor) },
    { id: "pending", header: "À prélever après encaissement", numeric: true, cell: (row) => formatMoneyExact(row.pendingMinor) },
    { id: "status", header: "État", role: "status", cell: (row) => <Badge tone="info">{row.retention}</Badge> },
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
            setOpenId(row.mandantId);
          }}
        >
          Détail<span className="sr-only"> des honoraires de {row.name}</span>
        </Button>
      ),
    },
  ];

  const exportCsv = () => {
    const rows = data.rows.map((row) => [row.name, row.mateRef, rateText(row.rateBp), csvAmount(row.collectedMinor), csvAmount(row.feeMinor), csvAmount(row.pendingMinor), row.retention]);
    downloadCsv(`honoraires-${period}.csv`, toCsv(["Mandant", "Mandat", "Taux (% TTC)", "Loyers encaissés", "Honoraires TTC", "À prélever après encaissement", "État"], rows));
    notify.success("Export téléchargé", plural(rows.length, "mandant exporté", "mandants exportés"));
  };

  return (
    <PageFrame
      crumbs={[{ label: "Finances" }, { label: "Honoraires" }]}
      title="Honoraires"
      description="Honoraires de gestion retenus sur les loyers encaissés, selon le barème de chaque mandat."
      actions={
        <>
          <Button variant="secondary" onClick={exportCsv}>
            <Icon icon={Download} />
            Exporter
          </Button>
          <LinkButton href="/finances/honoraires/bareme" variant="primary">
            <Icon icon={Percent} />
            Modifier le barème
          </LinkButton>
        </>
      }
    >
      <KpiGrid columns={4}>
        <Kpi label={yearly ? "Honoraires de l'année" : `Honoraires de ${data.label.split(" ")[0]?.toLowerCase() ?? ""}`} value={formatMoneyExact(data.feeMinor)} hint={`TTC, ${data.scheme.rateLabel} encaissés`} />
        <Kpi label="Honoraires hors taxe" value={formatMoneyExact(data.htMinor)} hint={`TVA 20 % : ${formatMoneyExact(data.vatMinor)}`} />
        <Kpi label="À prélever après encaissement" value={formatMoneyExact(data.pendingMinor)} hint={plural(data.unpaidCount, "loyer impayé", "loyers impayés")} />
        <Kpi label="Loyers encaissés" value={formatMoney(data.collectedMinor)} hint={`${plural(data.mandantsCount, "mandant", "mandants")}, ${plural(data.lotsCount, "lot", "lots")}`} />
      </KpiGrid>
      <SectionCard title="Honoraires par mandant">
        <Tabs
          value={period}
          defaultValue={CURRENT}
          onValueChange={(value) => {
            if (isPeriod(value)) onPeriodChange(value);
          }}
        >
          <TabList aria-label="Période des honoraires">
            {FEE_PERIODS.map((item) => (
              <Tab key={item.value} value={item.value}>
                {item.label}
              </Tab>
            ))}
          </TabList>
          <TabPanel value={period}>
            <DataTable
              caption="Honoraires par mandant"
              rows={data.rows}
              getRowId={(row) => row.mandantId}
              columns={columns}
              empty={<EmptyState icon={Receipt} title="Aucun honoraire" description="Aucun loyer n'a été encaissé sur cette période." />}
              {...(data.rows.length > 0 ? { footer: { collected: formatMoneyExact(data.collectedMinor), fee: formatMoneyExact(data.feeMinor), pending: formatMoneyExact(data.pendingMinor) } } : {})}
            />
          </TabPanel>
        </Tabs>
      </SectionCard>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SectionCard
          title="Barème appliqué"
          action={
            <LinkButton href="/finances/honoraires/bareme" variant="ghost" size="sm">
              Modifier
            </LinkButton>
          }
        >
          <div className="flex flex-col gap-3 px-4 pb-4">
            <DetailList
              items={[
                { label: "Gestion courante", value: data.scheme.rateLabel },
                { label: "Base de calcul", value: data.scheme.baseLabel },
                { label: "Mandats", value: `${String(data.scheme.sameRateCount)} sur ${String(data.scheme.totalMandants)} au même taux` },
              ]}
            />
            {data.scheme.upcoming.length > 0 ? (
              <ActionAlert tone="info" title="Nouveau barème à venir">
                {data.scheme.upcoming.map((item) => `${item.mandantName} : ${rateTtc(item.rateBp)} à partir du ${formatDate(item.effectiveFrom)} (avenant à signer)`).join(" · ")}
              </ActionAlert>
            ) : null}
          </div>
        </SectionCard>
        <SectionCard title={`Ventilation, ${data.label.split(" ")[0]?.toLowerCase() ?? ""}`}>
          <div className="px-4 pb-4">
            <SummaryLines
              lines={[
                { label: "Honoraires HT", value: formatMoneyExact(data.htMinor) },
                { label: "TVA 20 %", value: formatMoneyExact(data.vatMinor) },
                { label: "Honoraires TTC", value: formatMoneyExact(data.feeMinor) },
              ]}
            />
          </div>
        </SectionCard>
      </div>
      <FeeDetailDialog
        row={data.rows.find((row) => row.mandantId === openId) ?? null}
        periodLabel={data.label}
        showReversement={period === CURRENT}
        onClose={() => {
          setOpenId(null);
        }}
      />
    </PageFrame>
  );
}
