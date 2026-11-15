"use client";

import { Button, Chip, Select, StatCard, Tab, TabList, TabPanel, Tabs } from "@eguardimmo/ui";
import { Eye, FilePlus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ActionAlert } from "@/components/ui/ActionAlert";
import { DataList } from "@/components/ui/DataList";
import type { DataColumn } from "@/components/ui/DataList";
import { PageHeader } from "@/components/ui/PageHeader";
import { PillBadge } from "@/components/ui/PillBadge";
import { QueryState } from "@/components/ui/QueryState";
import { RowMenu } from "@/components/ui/RowMenu";
import { SearchField } from "@/components/ui/SearchField";
import { agenceRoutes, avisEcheanceHref, bailHref, locataireHref, mandantHref } from "@/espace/routes";
import { downloadCsv, toCsv } from "@/lib/csv";
import { daysBetween, formatDay } from "@/lib/dates";
import { formatEuros, formatEurosExact, formatEurosSigned } from "@/lib/money";
import { matchesQuery } from "@/lib/text";
import { bailKindLabel, bailPill, plural } from "../labels";
import { usePortefeuille } from "../queries";
import { balanceMinor, calledMinor } from "../selectors";
import type { Portefeuille } from "../selectors";
import type { Bail, BailStatus, Bien, Locataire, Mandant } from "../schemas";

interface BailLine {
  bail: Bail;
  bien: Bien | undefined;
  tenant: Locataire | undefined;
  mandant: Mandant | undefined;
}

type Segment = "en_cours" | "a_venir" | "termine" | "brouillon";
const SEGMENTS: readonly Segment[] = ["en_cours", "a_venir", "termine", "brouillon"];
const END_SOON_DAYS = 90;

const KIND_OPTIONS = [
  { value: "tous", label: "Tous" },
  { value: "vide", label: "Location vide" },
  { value: "meuble", label: "Location meublée" },
];

const EMPTY_MESSAGES: Record<Segment, { title: string; description: string }> = {
  en_cours: { title: "Aucun bail en cours", description: "Modifiez la recherche ou retirez un filtre." },
  a_venir: { title: "Aucun bail à venir", description: "Les baux dont l'entrée est future apparaissent ici." },
  termine: { title: "Aucun bail terminé", description: "Les baux échus ou résiliés apparaissent ici." },
  brouillon: { title: "Aucun brouillon", description: "Enregistrez un bail en brouillon pour le terminer plus tard." },
};

export function BauxPage() {
  const query = usePortefeuille();
  return (
    <QueryState query={query} label="La liste des baux">
      {(index) => <Baux index={index} />}
    </QueryState>
  );
}

function Baux({ index }: { index: Portefeuille }) {
  const { data } = index;
  const params = useSearchParams();
  const requested = params.get("statut");
  const [segment, setSegment] = useState<Segment>(SEGMENTS.find((item) => item === requested) ?? "en_cours");
  const [search, setSearch] = useState("");
  const [mandantId, setMandantId] = useState("tous");
  const [kind, setKind] = useState("tous");
  const [noticeOnly, setNoticeOnly] = useState(false);
  const [endingOnly, setEndingOnly] = useState(false);

  const all: BailLine[] = data.baux.map((bail) => {
    const bien = index.bien(bail.bienId);
    return { bail, bien, tenant: index.locataire(bail.locataireId), mandant: bien ? index.mandantOfBien(bien) : undefined };
  });
  const byStatus = (status: BailStatus) => all.filter((line) => line.bail.status === status);
  const current = byStatus("en_cours");
  const counts: Record<Segment, number> = {
    en_cours: current.length,
    a_venir: byStatus("a_venir").length,
    termine: byStatus("termine").length,
    brouillon: byStatus("brouillon").length,
  };
  const isEndingSoon = (bail: Bail) => daysBetween(data.todayIso, bail.endIso) <= END_SOON_DAYS;
  const notices = current.filter((line) => line.bail.noticeGiven);
  const ending = current.filter((line) => isEndingSoon(line.bail));
  const furnished = current.filter((line) => line.bail.furnished).length;
  const deposits = current.reduce((sum, line) => sum + line.bail.depositMinor, 0);
  const mandantOptions = [
    { value: "tous", label: "Tous" },
    ...data.mandants.filter((item) => all.some((line) => line.mandant?.id === item.id)).map((item) => ({ value: item.id, label: item.name })),
  ];

  const filtered = byStatus(segment).filter((line) => {
    if (noticeOnly && !line.bail.noticeGiven) return false;
    if (endingOnly && !isEndingSoon(line.bail)) return false;
    if (kind === "vide" && line.bail.furnished) return false;
    if (kind === "meuble" && !line.bail.furnished) return false;
    if (mandantId !== "tous" && line.mandant?.id !== mandantId) return false;
    return matchesQuery(search, line.bail.number, line.tenant?.name ?? "", line.bien?.name ?? "", line.mandant?.name ?? "");
  });

  const columns: DataColumn<BailLine>[] = [
    {
      id: "bail",
      header: "Bail",
      strong: true,
      cell: ({ bail, bien }) => (
        <>
          <Link href={bailHref(bail.id)} className="hover:underline">
            {bail.number}
          </Link>
          <span className="block text-caption font-normal text-fg-subtle">{bien ? `${bien.name}, ${bien.street}` : "Lot inconnu"}</span>
        </>
      ),
    },
    {
      id: "tenant",
      header: "Locataire",
      cell: ({ tenant }) =>
        tenant ? (
          <Link href={locataireHref(tenant.id)} className="hover:underline">
            {tenant.name}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      id: "mandant",
      header: "Mandant",
      cell: ({ mandant }) =>
        mandant ? (
          <Link href={mandantHref(mandant.id)} className="hover:underline">
            {mandant.name}
          </Link>
        ) : (
          "—"
        ),
    },
    { id: "kind", header: "Type", cell: ({ bail }) => bailKindLabel(bail) },
    { id: "rent", header: "Loyer charges comprises", numeric: true, cell: ({ bail }) => formatEurosExact(calledMinor(bail)) },
    { id: "end", header: "Fin", cell: ({ bail }) => formatDay(bail.endIso) },
    {
      id: "balance",
      header: "Solde",
      numeric: true,
      cell: ({ bail }) => {
        const amount = bail.status === "en_cours" ? balanceMinor(bail) : 0;
        return <span className={amount < 0 ? "font-semibold text-fg-danger" : undefined}>{amount === 0 ? formatEurosExact(0) : formatEurosSigned(amount).replace("-", "−")}</span>;
      },
    },
    { id: "state", header: "État", cell: ({ bail }) => <PillBadge pill={bailPill(bail)} /> },
    {
      id: "action",
      header: "Action",
      cell: ({ bail }) => (
        <span className="flex items-center gap-1">
          <Button variant="link" size="sm" asChild>
            <Link href={bailHref(bail.id)} aria-label={`Ouvrir le bail ${bail.number}`}>
              Ouvrir
            </Link>
          </Button>
          <RowMenu
            label={`Actions pour le bail ${bail.number}`}
            items={[
              { id: "voir", label: "Voir le bail", icon: Eye, href: bailHref(bail.id) },
              ...(bail.status === "en_cours" ? [{ id: "avis", label: "Émettre l'avis d'échéance", icon: FilePlus, href: avisEcheanceHref(bail.id) }] : []),
            ]}
          />
        </span>
      ),
    },
  ];

  const exportCsv = () => {
    downloadCsv(
      "baux.csv",
      toCsv(
        ["Bail", "Lot", "Locataire", "Mandant", "Type", "Loyer charges comprises (€)", "Début", "Fin", "État"],
        filtered.map(({ bail, bien, tenant, mandant }) => [
          bail.number,
          bien?.name ?? "",
          tenant?.name ?? "",
          mandant?.name ?? "",
          bailKindLabel(bail),
          (calledMinor(bail) / 100).toFixed(2),
          bail.startIso,
          bail.endIso,
          bailPill(bail).label,
        ]),
      ),
    );
  };

  return (
    <>
      <PageHeader
        title="Baux"
        description={`${plural(current.length, "bail en cours", "baux en cours")}, un bail par lot et par locataire.`}
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv}>
              Exporter
            </Button>
            <Button variant="secondary" asChild>
              <Link href={agenceRoutes.avisEcheance}>Avis d&apos;échéance</Link>
            </Button>
            <Button asChild>
              <Link href={agenceRoutes.bailNew}>Nouveau bail</Link>
            </Button>
          </>
        }
      />

      {notices.length > 0 ? (
        <ActionAlert
          tone="warning"
          title={plural(notices.length, "préavis donné", "préavis donnés")}
          action={
            <Button variant="secondary" size="sm" onClick={() => { setSegment("en_cours"); setNoticeOnly(true); }}>
              Voir les préavis
            </Button>
          }
        >
          {notices.map(({ bail, bien, tenant }) => `${tenant?.name ?? "Locataire"} (${bien?.name ?? "lot"}) quitte le lot le ${formatDay(bail.endIso)}`).join(", ")}.
        </ActionAlert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Baux en cours" value={current.length}>
          <span className="text-caption text-fg-subtle">{`${plural(current.length - furnished, "vide", "vides")}, ${plural(furnished, "meublé", "meublés")}`}</span>
        </StatCard>
        <StatCard label="Fin dans 90 jours" value={ending.length}>
          <span className="text-caption text-fg-subtle">{ending.length > 0 ? ending.map((line) => line.bail.number).join(", ") : "aucun bail à renouveler"}</span>
        </StatCard>
        <StatCard label="Dépôts détenus" value={formatEuros(deposits)}>
          <span className="text-caption text-fg-subtle">sur les baux en cours</span>
        </StatCard>
      </div>

      <Tabs value={segment} defaultValue="en_cours" onValueChange={(next) => { setSegment(next as Segment); }}>
        <TabList aria-label="Statuts de bail">
          <Tab value="en_cours" count={counts.en_cours}>En cours</Tab>
          <Tab value="a_venir" count={counts.a_venir}>À venir</Tab>
          <Tab value="termine" count={counts.termine}>Terminés</Tab>
          <Tab value="brouillon" count={counts.brouillon}>Brouillons</Tab>
        </TabList>
        <TabPanel value={segment} className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <SearchField label="Rechercher un bail" placeholder="Numéro, locataire, lot, ex. : B-2026-004" value={search} onChange={(event) => { setSearch(event.target.value); }} className="w-full sm:w-72" />
            <Select label="Mandant" placeholder="Tous" options={mandantOptions} value={mandantId} onValueChange={setMandantId} className="w-48" />
            <Select label="Type" placeholder="Tous" options={KIND_OPTIONS} value={kind} onValueChange={setKind} className="w-44" />
            <Chip pressed={noticeOnly} onClick={() => { setNoticeOnly((value) => !value); }}>Préavis donné</Chip>
            <Chip pressed={endingOnly} onClick={() => { setEndingOnly((value) => !value); }}>Fin sous 90 jours</Chip>
          </div>
          <DataList
            label="Liste des baux"
            rows={filtered}
            columns={columns}
            rowKey={(line) => line.bail.id}
            resetKey={`${segment}|${search}|${mandantId}|${kind}|${String(noticeOnly)}|${String(endingOnly)}`}
            emptyTitle={EMPTY_MESSAGES[segment].title}
            emptyDescription={EMPTY_MESSAGES[segment].description}
          />
        </TabPanel>
      </Tabs>
    </>
  );
}
