"use client";

import { Button, Chip, Icon, Select, StatCard, Tab, TabList, TabPanel, Tabs } from "@eguardimmo/ui";
import { Ban, Download, Eye, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { DataList } from "@/components/ui/DataList";
import type { DataColumn } from "@/components/ui/DataList";
import { PageHeader } from "@/components/ui/PageHeader";
import { PillBadge } from "@/components/ui/PillBadge";
import { QueryState } from "@/components/ui/QueryState";
import { SearchField } from "@/components/ui/SearchField";
import { useDemoDownload } from "@/components/ui/useDemoDownload";
import { agenceRoutes, mandantHref, mandatHref, mandatTerminationHref } from "@/espace/routes";
import { downloadCsv, toCsv } from "@/lib/csv";
import { daysBetween, formatDay } from "@/lib/dates";
import { matchesQuery } from "@/lib/text";
import { END_REQUEST_PILL, MANDAT_STATE_PILLS, TERMS_MISSING_LABEL, feeText, payoutText, plural } from "../labels";
import { usePortefeuille, usePortefeuilleAccess } from "../queries";
import { isOperational, mandatState } from "../selectors";
import type { MandatState, Portefeuille } from "../selectors";
import type { Mandant, Mandat } from "../schemas";
import { MandatMenu } from "./MandatMenu";
import { RenewMandatDialog } from "./RenewMandatDialog";

type Segment = "actifs" | "a_renouveler" | "termines" | "brouillons" | "archives" | "demandes";

interface MandatLine {
  mandat: Mandat;
  mandant: Mandant | undefined;
  lots: number;
  state: MandatState;
}

const SEGMENTS: readonly Segment[] = ["actifs", "a_renouveler", "termines", "brouillons", "archives", "demandes"];
const EXPIRY_WINDOW_DAYS = 90;

const inSegment = (line: MandatLine, segment: Segment): boolean => {
  if (segment === "archives") return line.mandat.archived === true;
  if (line.mandat.archived) return false;
  if (segment === "demandes") return line.mandat.hasEndRequest === true;
  if (segment === "actifs") return isOperational(line.state);
  if (segment === "a_renouveler") return line.state === "a_renouveler";
  if (segment === "termines") return line.state === "termine";
  return line.state === "brouillon";
};

const EXPIRY_OPTIONS = [
  { value: "toutes", label: "Toutes" },
  { value: "2026", label: "En 2026" },
  { value: "2027", label: "En 2027" },
  { value: "2028", label: "En 2028 ou après" },
];

export function MandatsPage() {
  const query = usePortefeuille();
  return (
    <QueryState query={query} label="La liste des mandats">
      {(index) => <Mandats index={index} />}
    </QueryState>
  );
}

function Mandats({ index }: { index: Portefeuille }) {
  const { data } = index;
  const params = useSearchParams();
  const requested = params.get("etat");
  const initial = SEGMENTS.find((segment) => segment === requested && (index.isApi || (segment !== "demandes" && segment !== "archives"))) ?? "actifs";
  const [segment, setSegment] = useState<Segment>(initial);
  const [search, setSearch] = useState("");
  const [expiry, setExpiry] = useState("toutes");
  const [soonOnly, setSoonOnly] = useState(false);
  const [renewing, setRenewing] = useState<string>();
  const download = useDemoDownload();
  const { canWrite } = usePortefeuilleAccess();

  const lines = useMemo<MandatLine[]>(
    () =>
      data.mandats.map((mandat) => ({
        mandat,
        mandant: index.mandant(mandat.mandantId),
        lots: index.lotCount(mandat),
        state: mandatState(mandat, data.todayIso),
      })),
    [data, index],
  );
  const count = (segmentValue: Segment) => lines.filter((line) => inSegment(line, segmentValue)).length;
  const operational = lines.filter((line) => isOperational(line.state));
  const covered = operational.reduce((sum, line) => sum + line.lots, 0);
  const rates = new Set(operational.map((line) => feeText(line.mandat, !index.isApi)));
  const renewals = lines.filter((line) => line.state === "a_renouveler");

  const filtered = lines.filter((line) => {
    if (!inSegment(line, segment)) return false;
    if (expiry !== "toutes") {
      const year = Number(line.mandat.endIso.slice(0, 4));
      if (expiry === "2028" ? year < 2028 : year !== Number(expiry)) return false;
    }
    if (soonOnly) {
      const days = daysBetween(data.todayIso, line.mandat.endIso);
      if (days < 0 || days > EXPIRY_WINDOW_DAYS) return false;
    }
    return matchesQuery(search, line.mandat.number, line.mandant?.name ?? "", line.mandant?.legal ?? "");
  });

  const columns: DataColumn<MandatLine>[] = [
    {
      id: "number",
      header: "Numéro",
      strong: true,
      cell: ({ mandat }) => (
        <Link href={mandatHref(mandat.id)} className="hover:underline">
          {mandat.number}
        </Link>
      ),
    },
    {
      id: "mandant",
      header: "Mandant",
      cell: ({ mandant }) =>
        mandant ? (
          <>
            <Link href={mandantHref(mandant.id)} className="font-medium text-fg hover:underline">
              {mandant.name}
            </Link>
            <span className="block text-caption text-fg-subtle">{mandant.legal}</span>
          </>
        ) : (
          "—"
        ),
    },
    { id: "lots", header: "Biens", cell: ({ lots }) => plural(lots, "lot", "lots") },
    { id: "fees", header: "Honoraires", cell: ({ mandat }) => feeText(mandat, !index.isApi) },
    { id: "payout", header: "Reversement", cell: ({ mandat }) => payoutText(mandat) },
    { id: "end", header: "Échéance", cell: ({ mandat }) => formatDay(mandat.endIso) },
    {
      id: "state",
      header: "État",
      cell: ({ mandat, state }) => (
        <span className="flex flex-wrap items-center gap-1">
          <PillBadge pill={MANDAT_STATE_PILLS[state]} />
          {mandat.hasEndRequest === true ? <PillBadge pill={END_REQUEST_PILL} /> : null}
        </span>
      ),
    },
    {
      id: "action",
      header: "Action",
      cell: ({ mandat, state }) => (
        <span className="flex items-center gap-1">
          <Button variant="link" size="sm" asChild>
            <Link href={mandatHref(mandat.id)} aria-label={`Ouvrir le mandat ${mandat.number}`}>
              Ouvrir
            </Link>
          </Button>
          <MandatMenu
            mandat={mandat}
            state={state}
            todayIso={data.todayIso}
            label={`Actions pour le mandat ${mandat.number}`}
            items={[
              { id: "voir", label: "Voir le mandat", icon: Eye, href: mandatHref(mandat.id) },
              ...(index.isApi ? [] : [{ id: "telecharger", label: "Télécharger le mandat", icon: Download, onSelect: () => { download(`Mandat ${mandat.number}`); } }]),
              ...(canWrite && state === "a_renouveler" ? [{ id: "renouveler", label: "Renouveler", icon: RefreshCw, onSelect: () => { setRenewing(mandat.id); } }] : []),
              ...(canWrite && isOperational(state) && state !== "resilie" && state !== "suspendu"
                ? [{ id: "fin", label: "Mettre fin au mandat", icon: Ban, href: mandatTerminationHref(mandat.id), tone: "danger" as const, separatorBefore: true }]
                : []),
            ]}
          />
        </span>
      ),
    },
  ];

  const exportCsv = () => {
    downloadCsv(
      "mandats.csv",
      toCsv(
        ["Numéro", "Mandant", "Biens", "Honoraires (%)", "Jour de reversement", "Échéance", "État"],
        filtered.map((line) => [
          line.mandat.number,
          line.mandant?.name ?? "",
          String(line.lots),
          line.mandat.termsMissing !== true && line.mandat.flatFeeMinor === undefined ? String(line.mandat.feeBasisPoints / 100) : feeText(line.mandat, false),
          line.mandat.termsMissing === true ? TERMS_MISSING_LABEL : String(line.mandat.payoutDay),
          formatDay(line.mandat.endIso),
          MANDAT_STATE_PILLS[line.state].label,
        ]),
      ),
    );
  };

  return (
    <>
      <PageHeader
        title="Mandats"
        description="Un mandat par mandant : biens confiés, honoraires, jour de reversement et échéance."
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv}>
              <Icon icon={Download} />
              Exporter
            </Button>
            {canWrite ? (
              <Button asChild>
                <Link href={agenceRoutes.mandatNew}>
                  <Icon icon={Plus} />
                  Nouveau mandat
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Mandats actifs" value={operational.length}>
          <span className="text-caption text-fg-subtle">{plural(covered, "lot couvert", "lots couverts")}</span>
        </StatCard>
        <StatCard label="Honoraires" value={rates.size === 1 ? [...rates][0] ?? "—" : "Variables"}>
          <span className="text-caption text-fg-subtle">{rates.size === 1 ? "taux identique sur tous les mandats" : "selon le mandat"}</span>
        </StatCard>
        <StatCard label="À renouveler" value={renewals.length}>
          <span className="text-caption text-fg-subtle">{renewals.map((line) => line.mandat.number).join(" et ") || "aucune échéance proche"}</span>
        </StatCard>
      </div>

      <Tabs value={segment} defaultValue="actifs" onValueChange={(next) => { setSegment(next as Segment); }}>
        <TabList aria-label="Segments de mandats">
          <Tab value="actifs" count={count("actifs")}>Actifs</Tab>
          <Tab value="a_renouveler" count={count("a_renouveler")}>À renouveler</Tab>
          <Tab value="termines" count={count("termines")}>Terminés</Tab>
          {count("brouillons") > 0 ? <Tab value="brouillons" count={count("brouillons")}>Brouillons</Tab> : null}
          {index.isApi ? <Tab value="demandes" count={count("demandes")}>Demandes de fin de mandat</Tab> : null}
          {index.isApi ? <Tab value="archives" count={count("archives")}>Archivés</Tab> : null}
        </TabList>
        <TabPanel value={segment} className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <SearchField label="Rechercher un mandat" placeholder="Numéro, mandant, ex. : M-2025-0142" value={search} onChange={(event) => { setSearch(event.target.value); }} className="w-full sm:w-72" />
            <Select label="Échéance" placeholder="Toutes" options={EXPIRY_OPTIONS} value={expiry} onValueChange={setExpiry} className="w-44" />
            <Chip pressed={soonOnly} onClick={() => { setSoonOnly((current) => !current); }}>
              Échéance dans 90 jours
            </Chip>
          </div>
          <DataList
            label="Liste des mandats"
            rows={filtered}
            columns={columns}
            rowKey={(line) => line.mandat.id}
            resetKey={`${segment}|${search}|${expiry}|${String(soonOnly)}`}
            emptyTitle="Aucun mandat ne correspond"
            emptyDescription="Modifiez la recherche, l'échéance ou le segment."
          />
        </TabPanel>
      </Tabs>

      <RenewMandatDialog mandat={renewing ? index.mandat(renewing) : undefined} onOpenChange={(open) => { if (!open) setRenewing(undefined); }} />
    </>
  );
}
