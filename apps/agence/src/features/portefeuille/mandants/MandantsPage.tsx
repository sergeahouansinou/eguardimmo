"use client";

import { Button, Chip, Icon, Select, StatCard, Tab, TabList, TabPanel, Tabs } from "@eguardimmo/ui";
import { Eye, Mail, Wallet, Download, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ActionAlert } from "@/components/ui/ActionAlert";
import { DataList } from "@/components/ui/DataList";
import type { DataColumn } from "@/components/ui/DataList";
import { PageHeader } from "@/components/ui/PageHeader";
import { PillBadge } from "@/components/ui/PillBadge";
import { QueryState } from "@/components/ui/QueryState";
import { RowMenu } from "@/components/ui/RowMenu";
import { SearchField } from "@/components/ui/SearchField";
import { agenceRoutes, mandantHref } from "@/espace/routes";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatDay } from "@/lib/dates";
import { formatEuros, formatEurosExact } from "@/lib/money";
import { matchesQuery } from "@/lib/text";
import { MANDANT_TYPE_LABELS, MANDAT_STATE_PILLS, UNAVAILABLE, plural } from "../labels";
import { usePortefeuille, usePortefeuilleAccess } from "../queries";
import { mandantFigures, mandatState } from "../selectors";
import type { MandantFigures, Portefeuille } from "../selectors";
import type { Mandant, Mandat } from "../schemas";

interface MandantLine extends MandantFigures {
  mandant: Mandant;
  mandat: Mandat | undefined;
}

type SegmentValue = "tous" | "particulier" | "societes" | "a_renouveler";

const TYPE_OPTIONS = [
  { value: "tous", label: "Tous" },
  { value: "particulier", label: MANDANT_TYPE_LABELS.particulier },
  { value: "societe", label: MANDANT_TYPE_LABELS.societe },
  { value: "indivision", label: MANDANT_TYPE_LABELS.indivision },
];

const STATE_OPTIONS = [
  { value: "tous", label: "Tous" },
  { value: "actif", label: "Actif" },
  { value: "a_renouveler", label: "À renouveler" },
];

export function MandantsPage() {
  const query = usePortefeuille();
  return (
    <QueryState query={query} label="La liste des mandants">
      {(index) => <Mandants index={index} />}
    </QueryState>
  );
}

function Mandants({ index }: { index: Portefeuille }) {
  const { data } = index;
  const [search, setSearch] = useState("");
  const [type, setType] = useState("tous");
  const [state, setState] = useState("tous");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [segment, setSegment] = useState<SegmentValue>("tous");
  const { canWrite } = usePortefeuilleAccess();
  const api = index.isApi;

  const lines = useMemo<MandantLine[]>(
    () =>
      data.mandants.map((mandant) => {
        const mandat = index.activeMandat(mandant.id);
        const figures = mandantFigures(index, mandant.id);
        return { mandant, mandat, ...figures, lots: index.isApi ? (mandat ? index.lotCount(mandat) : 0) : figures.lots };
      }),
    [data, index],
  );
  const stateOf = (line: MandantLine) => (line.mandat ? mandatState(line.mandat, data.todayIso) : "termine");
  const renewals = lines.filter((line) => stateOf(line) === "a_renouveler");
  const lots = lines.reduce((sum, line) => sum + line.lots, 0);
  const called = lines.reduce((sum, line) => sum + line.calledMinor, 0);
  const lastRenewal = renewals.map((line) => line.mandat?.endIso ?? "").sort().at(-1);

  const filtered = lines.filter((line) => {
    if (segment === "particulier" && line.mandant.type !== "particulier") return false;
    if (segment === "societes" && line.mandant.type === "particulier") return false;
    if (segment === "a_renouveler" && stateOf(line) !== "a_renouveler") return false;
    if (type !== "tous" && line.mandant.type !== type) return false;
    if (state !== "tous" && stateOf(line) !== state) return false;
    if (pendingOnly && line.payoutMinor <= 0) return false;
    return matchesQuery(search, line.mandant.name, line.mandant.legal, line.mandat?.number ?? "");
  });

  const columns: DataColumn<MandantLine>[] = [
    {
      id: "mandant",
      header: "Mandant",
      strong: true,
      cell: ({ mandant }) => (
        <>
          <Link href={mandantHref(mandant.id)} className="hover:underline">
            {mandant.name}
          </Link>
          <span className="block text-caption font-normal text-fg-subtle">{mandant.legal}</span>
        </>
      ),
    },
    { id: "mandat", header: "Mandat", cell: ({ mandat }) => mandat?.number ?? "—" },
    { id: "lots", header: "Lots", numeric: true, cell: ({ lots: count }) => count },
    ...(api
      ? []
      : [
          { id: "called", header: "Loyers appelés", numeric: true, cell: ({ calledMinor }: MandantLine) => formatEurosExact(calledMinor) },
          { id: "payout", header: "À reverser", numeric: true, strong: true, cell: ({ payoutMinor }: MandantLine) => formatEurosExact(payoutMinor) },
        ]),
    { id: "end", header: "Fin du mandat", cell: ({ mandat }) => (mandat ? formatDay(mandat.endIso) : "—") },
    {
      id: "state",
      header: "État",
      cell: (line) => <PillBadge pill={MANDAT_STATE_PILLS[stateOf(line)]} />,
    },
    {
      id: "action",
      header: "Action",
      cell: ({ mandant }) => (
        <span className="flex items-center gap-1">
          <Button variant="link" size="sm" asChild>
            <Link href={mandantHref(mandant.id)} aria-label={`Ouvrir la fiche de ${mandant.name}`}>
              Ouvrir
            </Link>
          </Button>
          <RowMenu
            label={`Actions pour ${mandant.name}`}
            items={[
              { id: "fiche", label: "Voir la fiche", icon: Eye, href: mandantHref(mandant.id) },
              { id: "ecrire", label: "Écrire", icon: Mail, href: agenceRoutes.messageNew },
              ...(api ? [] : [{ id: "reversement", label: "Préparer le reversement", icon: Wallet, href: agenceRoutes.reversementLot }]),
            ]}
          />
        </span>
      ),
    },
  ];

  const exportCsv = () => {
    downloadCsv(
      "mandants.csv",
      toCsv(
        ["Mandant", "Type", "Mandat", "Lots", ...(api ? [] : ["Loyers appelés (€)", "À reverser (€)"]), "Fin du mandat", "État"],
        filtered.map((line) => [
          line.mandant.name,
          line.mandant.legal,
          line.mandat?.number ?? "",
          String(line.lots),
          ...(api ? [] : [(line.calledMinor / 100).toFixed(2), (line.payoutMinor / 100).toFixed(2)]),
          line.mandat ? formatDay(line.mandat.endIso) : "",
          MANDAT_STATE_PILLS[stateOf(line)].label,
        ]),
      ),
    );
  };

  return (
    <>
      <PageHeader
        title="Mandants"
        description={`${plural(data.mandants.length, "mandant", "mandants")}, ${plural(lots, "lot", "lots")} sous mandat. Chacun ne voit que ses propres biens dans son espace propriétaire.`}
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv}>
              <Icon icon={Download} />
              Exporter
            </Button>
            {canWrite && !api ? (
              <Button asChild>
                <Link href={agenceRoutes.mandantNew}>
                  <Icon icon={Plus} />
                  Nouveau mandant
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {renewals.length > 0 ? (
        <ActionAlert
          tone="warning"
          title={`${plural(renewals.length, "mandat arrive", "mandats arrivent")} à échéance`}
          action={
            <Button variant="secondary" size="sm" asChild>
              <Link href={`${agenceRoutes.mandats}?etat=a_renouveler`}>Voir les mandats</Link>
            </Button>
          }
        >
          {renewals.map((line) => `${line.mandant.name} le ${formatDay(line.mandat?.endIso ?? "")}`).join(", ")}. Proposez le renouvellement avant l&apos;échéance.
        </ActionAlert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Mandants" value={data.mandants.length}>
          <span className="text-caption text-fg-subtle">{`${plural(lots, "lot", "lots")} sous mandat`}</span>
        </StatCard>
        <StatCard label="Loyers appelés par mois" value={api ? UNAVAILABLE : formatEuros(called)}>
          <span className="text-caption text-fg-subtle">{api ? "les baux ne sont pas encore reliés" : "charges comprises"}</span>
        </StatCard>
        <StatCard label="Mandats à renouveler" value={renewals.length}>
          <span className="text-caption text-fg-subtle">{lastRenewal ? `avant le ${formatDay(lastRenewal)}` : "aucune échéance proche"}</span>
        </StatCard>
      </div>

      <Tabs value={segment} defaultValue="tous" onValueChange={(next) => { setSegment(next as SegmentValue); }}>
        <TabList aria-label="Segments de mandants">
          <Tab value="tous" count={lines.length}>Tous</Tab>
          <Tab value="particulier" count={lines.filter((line) => line.mandant.type === "particulier").length}>Particuliers</Tab>
          <Tab value="societes" count={lines.filter((line) => line.mandant.type !== "particulier").length}>Sociétés et indivisions</Tab>
          <Tab value="a_renouveler" count={renewals.length}>À renouveler</Tab>
        </TabList>
        <TabPanel value={segment} className="flex min-w-0 flex-col gap-3">

      <div className="flex flex-wrap items-end gap-2">
        <SearchField label="Rechercher un mandant" placeholder="Nom, mandat, ex. : Chevalier" value={search} onChange={(event) => { setSearch(event.target.value); }} className="w-full sm:w-72" />
        <Select label="Type" placeholder="Tous" options={TYPE_OPTIONS} value={type} onValueChange={setType} className="w-40" />
        <Select label="État" placeholder="Tous" options={STATE_OPTIONS} value={state} onValueChange={setState} className="w-40" />
        {api ? null : (
          <Chip pressed={pendingOnly} onClick={() => { setPendingOnly((current) => !current); }}>
            Reversement en attente
          </Chip>
        )}
      </div>

      <DataList
        label="Liste des mandants"
        rows={filtered}
        columns={columns}
        rowKey={(line) => line.mandant.id}
        resetKey={`${search}|${type}|${state}|${String(pendingOnly)}|${segment}`}
        emptyTitle="Aucun mandant ne correspond"
        emptyDescription="Modifiez la recherche ou retirez un filtre."
      />
        </TabPanel>
      </Tabs>
    </>
  );
}
