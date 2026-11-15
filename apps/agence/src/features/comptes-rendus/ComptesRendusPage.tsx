"use client";

import { Badge, Button, Card, Chip, EmptyState, Icon, Pagination, Select, Tab, TabList, TabPanel, Tabs } from "@eguardimmo/ui";
import { FileText, ScrollText } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { QueryState } from "@/components/ui/QueryState";
import { DataTable, Kpi, KpiGrid, LinkButton, PageFrame, useNotify, usePagination } from "@/features/kit";
import { formatDate } from "@/features/shared/dates";
import { MANDANTS } from "@/features/shared/directory";
import { messageOf } from "@/features/shared/errors";
import { formatMoneyExact, sum } from "@/features/shared/money";
import { downloadCsv } from "@/lib/csv";
import { lastDayOf } from "./compose";
import { reportsCsv } from "./csv";
import { ROW_ACTIONS, STATE_LABELS, STATE_TONES, apercuHref, withPreposition } from "./labels";
import { useGenerate, useOverview } from "./queries";
import { DEFAULT_CONTENT } from "./schemas";
import type { Overview, ReportRow } from "./schemas";

type TabKey = "a_generer" | "generes" | "envoyes";

const PAGE_SIZE = 10;
const ALL = "all";
const MANDANT_OPTIONS = [{ value: ALL, label: "Tous les mandants" }, ...MANDANTS.map((mandant) => ({ value: mandant.id, label: mandant.name }))];

function tabOf(row: ReportRow): TabKey {
  if (row.state === "publie") return "envoyes";
  return row.state === "genere" ? "generes" : "a_generer";
}

function parseTab(value: string | null): TabKey {
  return value === "generes" || value === "envoyes" ? value : "a_generer";
}

export function ComptesRendusPage() {
  const overview = useOverview();
  const initialTab = parseTab(useSearchParams().get("onglet"));
  return (
    <PageFrame
      crumbs={[{ label: "Finances" }, { label: "Comptes rendus" }]}
      title="Comptes rendus de gestion"
      description="Un document par mandant : loyers encaissés, honoraires, reversement et impayés. Il est publié dans son espace propriétaire."
      actions={
        <LinkButton href="/comptes-rendus/nouveau" variant="primary">
          <Icon icon={ScrollText} />
          Générer les comptes rendus
        </LinkButton>
      }
    >
      <QueryState query={overview} label="Les comptes rendus">
        {(data) => <Content overview={data} initialTab={initialTab} />}
      </QueryState>
    </PageFrame>
  );
}

function Content({ overview, initialTab }: { overview: Overview; initialTab: TabKey }) {
  const router = useRouter();
  const notify = useNotify();
  const generate = useGenerate();
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [mandant, setMandant] = useState(ALL);
  const [period, setPeriod] = useState(initialTab === "a_generer" ? overview.currentPeriod : ALL);
  const [draftOnly, setDraftOnly] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  const counts: Record<TabKey, number> = { a_generer: 0, generes: 0, envoyes: 0 };
  overview.rows.forEach((row) => {
    counts[tabOf(row)] += 1;
  });
  const toGenerate = overview.rows.filter((row) => tabOf(row) === "a_generer" && row.periodKey === overview.currentPeriod).length;
  const periods = [...new Map(overview.rows.map((row) => [row.periodKey, row.periodLabel])).entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const periodOptions = [{ value: ALL, label: "Toutes les périodes" }, ...periods.map(([value, label]) => ({ value, label }))];

  const filtered = overview.rows
    .filter((row) => tabOf(row) === tab && (mandant === ALL || row.mandantId === mandant) && (period === ALL || row.periodKey === period) && (!draftOnly || row.state === "brouillon"))
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey) || a.mandantName.localeCompare(b.mandantName));
  const pagination = usePagination(filtered, PAGE_SIZE);

  const generateRow = (row: ReportRow) => {
    setGenerating(row.id);
    generate.mutate(
      {
        kind: "mensuel",
        from: `${row.periodKey}-01`,
        to: lastDayOf(row.periodKey),
        mandantIds: [row.mandantId],
        content: [...DEFAULT_CONTENT],
        publication: "planifiee",
        notify: true,
        draft: false,
      },
      {
        onSuccess: ({ ids }) => {
          notify.success("Compte rendu généré", `${row.mandantName}, ${row.periodLabel.toLowerCase()}.`);
          router.push(apercuHref(ids[0] ?? row.id));
        },
        onError: (error) => {
          notify.error("Génération impossible", messageOf(error));
        },
        onSettled: () => {
          setGenerating(null);
        },
      },
    );
  };

  const exportCsv = () => {
    downloadCsv("comptes-rendus.csv", reportsCsv(filtered));
    notify.success("Export prêt", `${String(filtered.length)} compte${filtered.length > 1 ? "s" : ""} rendu${filtered.length > 1 ? "s" : ""} exporté${filtered.length > 1 ? "s" : ""} en CSV.`);
  };

  const changeFilter = (apply: () => void) => {
    apply();
    pagination.setPage(1);
  };

  const lastSend = overview.lastSend;
  const monthWord = overview.currentPeriodLabel.split(" ")[0]?.toLowerCase() ?? "";

  return (
    <>
      <KpiGrid columns={3}>
        <Kpi label="À générer" value={toGenerate} hint={`comptes rendus ${withPreposition(monthWord)}`} />
        <Kpi
          label="Dernier envoi"
          value={lastSend ? formatDate(lastSend.on) : "—"}
          hint={
            lastSend
              ? `${String(lastSend.count)} compte${lastSend.count > 1 ? "s" : ""} rendu${lastSend.count > 1 ? "s" : ""} ${withPreposition(lastSend.periodShort)}, ${lastSend.unknownReads ? "pas encore lus" : `lus ${String(lastSend.read)} sur ${String(lastSend.count)}`}`
              : "aucun envoi pour le moment"
          }
        />
        <Kpi label="Prochain envoi" value={formatDate(overview.nextSendOn)} hint="avec les reversements" />
      </KpiGrid>
      <Card role="region" aria-label="Liste des comptes rendus">
        <Tabs
          value={tab}
          defaultValue="a_generer"
          onValueChange={(next) => {
            const key = next as TabKey;
            setTab(key);
            setPeriod(key === "a_generer" ? overview.currentPeriod : ALL);
            setDraftOnly(false);
            pagination.setPage(1);
          }}
        >
          <TabList aria-label="État des comptes rendus">
            <Tab value="a_generer" count={counts.a_generer}>
              À générer
            </Tab>
            <Tab value="generes" count={counts.generes}>
              Générés
            </Tab>
            <Tab value="envoyes" count={counts.envoyes}>
              Envoyés
            </Tab>
          </TabList>
          <TabPanel value={tab} className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <Select
                label="Mandant"
                hideLabel
                placeholder="Mandant"
                options={MANDANT_OPTIONS}
                value={mandant}
                className="w-full sm:w-52"
                onValueChange={(next) => {
                  changeFilter(() => {
                    setMandant(next);
                  });
                }}
              />
              <Select
                label="Période"
                hideLabel
                placeholder="Période"
                options={periodOptions}
                value={period}
                className="w-full sm:w-52"
                onValueChange={(next) => {
                  changeFilter(() => {
                    setPeriod(next);
                  });
                }}
              />
              {tab === "a_generer" ? (
                <Chip
                  pressed={draftOnly}
                  onClick={() => {
                    changeFilter(() => {
                      setDraftOnly((current) => !current);
                    });
                  }}
                >
                  Brouillon
                </Chip>
              ) : null}
              <Button variant="secondary" className="sm:ml-auto" onClick={exportCsv} disabled={filtered.length === 0}>
                Exporter
              </Button>
            </div>
            <DataTable
              caption="Comptes rendus"
              rows={pagination.slice}
              getRowId={(row) => row.id}
              footerLabel="Total"
              footer={
                filtered.length === 0
                  ? undefined
                  : {
                      collected: formatMoneyExact(sum(filtered.map((row) => row.collectedMinor))),
                      fee: formatMoneyExact(sum(filtered.map((row) => row.feeMinor))),
                      net: formatMoneyExact(sum(filtered.map((row) => row.netMinor))),
                    }
              }
              empty={
                <EmptyState
                  icon={FileText}
                  title="Aucun compte rendu"
                  description={mandant !== ALL || draftOnly || (period !== ALL && tab !== "a_generer") ? "Modifiez les filtres." : "Rien à afficher dans cet onglet pour le moment."}
                />
              }
              columns={[
                {
                  id: "mandant",
                  header: "Mandant",
                  role: "title",
                  cell: (row) => (
                    <span className="flex flex-col">
                      <span>{row.mandantName}</span>
                      <span className="text-caption font-normal text-fg-subtle">{row.mandantKind}</span>
                    </span>
                  ),
                },
                { id: "period", header: "Période", cell: (row) => row.periodLabel },
                { id: "collected", header: "Loyers encaissés", numeric: true, cell: (row) => formatMoneyExact(row.collectedMinor) },
                { id: "fee", header: "Honoraires", numeric: true, cell: (row) => formatMoneyExact(row.feeMinor) },
                { id: "net", header: "Net à reverser", numeric: true, cell: (row) => formatMoneyExact(row.netMinor) },
                {
                  id: "last",
                  header: "Dernier envoi",
                  cell: (row) => (row.lastSentOn ? `${formatDate(row.lastSentOn)}, ${row.lastSentShort ?? ""}` : "—"),
                },
                { id: "state", header: "État", role: "status", cell: (row) => <Badge tone={STATE_TONES[row.state]}>{STATE_LABELS[row.state]}</Badge> },
                {
                  id: "action",
                  header: "Action",
                  hideHeader: true,
                  role: "action",
                  cell: (row) =>
                    row.state === "a_generer" ? (
                      <Button
                        variant="link"
                        size="sm"
                        loading={generating === row.id}
                        aria-label={`Générer le compte rendu de ${row.mandantName}`}
                        onClick={() => {
                          generateRow(row);
                        }}
                      >
                        {ROW_ACTIONS[row.state]}
                      </Button>
                    ) : (
                      <Button variant="link" size="sm" asChild>
                        <Link href={apercuHref(row.id)} aria-label={`${ROW_ACTIONS[row.state]} le compte rendu de ${row.mandantName}`}>
                          {ROW_ACTIONS[row.state]}
                        </Link>
                      </Button>
                    ),
                },
              ]}
            />
            <Pagination page={pagination.page} pageSize={PAGE_SIZE} total={pagination.total} label="Pagination des comptes rendus" onPageChange={pagination.setPage} />
          </TabPanel>
        </Tabs>
      </Card>
    </>
  );
}
