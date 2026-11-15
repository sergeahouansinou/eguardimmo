"use client";

import { Button, Chip, Select, StatCard, Tab, TabList, TabPanel, Tabs } from "@eguardimmo/ui";
import { CreditCard, Eye, Mail } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DataList } from "@/components/ui/DataList";
import type { DataColumn } from "@/components/ui/DataList";
import { PageHeader } from "@/components/ui/PageHeader";
import { PillBadge } from "@/components/ui/PillBadge";
import { QueryState } from "@/components/ui/QueryState";
import { RowMenu } from "@/components/ui/RowMenu";
import { SearchField } from "@/components/ui/SearchField";
import { agenceRoutes, bienHref, locataireHref, mandantHref } from "@/espace/routes";
import { downloadCsv, toCsv } from "@/lib/csv";
import { monthName } from "@/lib/dates";
import { formatEuros, formatEurosExact } from "@/lib/money";
import { matchesQuery } from "@/lib/text";
import { bienPill, plural } from "../labels";
import { usePortefeuille } from "../queries";
import { balanceMinor, bailSituation, calledMinor, collectedMinor, isOperational, mandatState } from "../selectors";
import type { Portefeuille } from "../selectors";
import type { Bail, Bien, Locataire, Mandant } from "../schemas";

interface BienLine {
  bien: Bien;
  bail: Bail | undefined;
  tenant: Locataire | undefined;
  mandant: Mandant | undefined;
}

type Segment = "tous" | "payes" | "impayes" | "preavis";

export function BiensPage() {
  const query = usePortefeuille();
  return (
    <QueryState query={query} label="La liste des biens">
      {(index) => <Biens index={index} />}
    </QueryState>
  );
}

function Biens({ index }: { index: Portefeuille }) {
  const { data } = index;
  const [segment, setSegment] = useState<Segment>("tous");
  const [search, setSearch] = useState("");
  const [mandantId, setMandantId] = useState("tous");
  const [city, setCity] = useState("toutes");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [noticeOnly, setNoticeOnly] = useState(false);

  const lines = useMemo<BienLine[]>(
    () =>
      data.biens
        .filter((bien) => {
          const mandat = index.mandat(bien.mandatId);
          return mandat !== undefined && isOperational(mandatState(mandat, data.todayIso));
        })
        .map((bien) => {
          const bail = index.currentBail(bien.id);
          return { bien, bail, tenant: bail ? index.locataire(bail.locataireId) : undefined, mandant: index.mandantOfBien(bien) };
        }),
    [data, index],
  );
  const situationOf = (line: BienLine) => (line.bail ? bailSituation(line.bail) : "a_jour");
  const counts = {
    tous: lines.length,
    payes: lines.filter((line) => situationOf(line) !== "impaye").length,
    impayes: lines.filter((line) => situationOf(line) === "impaye").length,
    preavis: lines.filter((line) => situationOf(line) === "preavis").length,
  };
  const called = lines.reduce((sum, line) => sum + (line.bail ? calledMinor(line.bail) : 0), 0);
  const collected = lines.reduce((sum, line) => sum + (line.bail ? collectedMinor(line.bail) : 0), 0);
  const unpaid = lines.reduce((sum, line) => sum - (line.bail ? balanceMinor(line.bail) : 0), 0);
  const rented = lines.filter((line) => line.bail).length;
  const mandantCount = new Set(lines.map((line) => line.mandant?.id)).size;

  const mandantOptions = [{ value: "tous", label: "Tous" }, ...data.mandants.filter((item) => lines.some((line) => line.mandant?.id === item.id)).map((item) => ({ value: item.id, label: item.name }))];
  const cityOptions = [{ value: "toutes", label: "Toutes" }, ...[...new Set(lines.map((line) => line.bien.city))].sort().map((name) => ({ value: name, label: name }))];

  const filtered = lines.filter((line) => {
    const situation = situationOf(line);
    if (segment === "payes" && situation === "impaye") return false;
    if (segment === "impayes" && situation !== "impaye") return false;
    if (segment === "preavis" && situation !== "preavis") return false;
    if (overdueOnly && situation !== "impaye") return false;
    if (noticeOnly && situation !== "preavis") return false;
    if (mandantId !== "tous" && line.mandant?.id !== mandantId) return false;
    if (city !== "toutes" && line.bien.city !== city) return false;
    return matchesQuery(search, line.bien.name, line.bien.street, line.bien.city, line.tenant?.name ?? "", line.mandant?.name ?? "");
  });

  const columns: DataColumn<BienLine>[] = [
    {
      id: "lot",
      header: "Lot",
      strong: true,
      cell: ({ bien }) => (
        <>
          <Link href={bienHref(bien.id)} className="hover:underline">
            {bien.name}
          </Link>
          <span className="block text-caption font-normal text-fg-subtle">{`${bien.kind}, ${String(bien.surfaceM2)} m²`}</span>
        </>
      ),
    },
    { id: "address", header: "Adresse", cell: ({ bien }) => `${bien.street}, ${bien.postalCode} ${bien.city}` },
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
    { id: "rent", header: "Loyer charges comprises", numeric: true, cell: ({ bail }) => (bail ? formatEurosExact(calledMinor(bail)) : "—") },
    { id: "state", header: "État", cell: ({ bail }) => <PillBadge pill={bienPill(bail, data.todayIso)} /> },
    {
      id: "action",
      header: "Action",
      cell: ({ bien }) => (
        <span className="flex items-center gap-1">
          <Button variant="link" size="sm" asChild>
            <Link href={bienHref(bien.id)} aria-label={`Ouvrir la fiche du lot ${bien.name}`}>
              Ouvrir
            </Link>
          </Button>
          <RowMenu
            label={`Actions pour le lot ${bien.name}`}
            items={[
              { id: "fiche", label: "Voir la fiche", icon: Eye, href: bienHref(bien.id) },
              { id: "ecrire", label: "Écrire au locataire", icon: Mail, href: agenceRoutes.messageNew },
              { id: "paiement", label: "Enregistrer un paiement", icon: CreditCard, href: agenceRoutes.encaissementNew },
            ]}
          />
        </span>
      ),
    },
  ];

  const exportCsv = () => {
    downloadCsv(
      "biens-sous-mandat.csv",
      toCsv(
        ["Lot", "Type", "Adresse", "Mandant", "Locataire", "Loyer charges comprises (€)", "État"],
        filtered.map((line) => [
          line.bien.name,
          line.bien.kind,
          `${line.bien.street}, ${line.bien.postalCode} ${line.bien.city}`,
          line.mandant?.name ?? "",
          line.tenant?.name ?? "",
          line.bail ? (calledMinor(line.bail) / 100).toFixed(2) : "",
          bienPill(line.bail, data.todayIso).label,
        ]),
      ),
    );
  };

  return (
    <>
      <PageHeader
        title="Biens sous mandat"
        description={`${plural(rented, "lot loué", "lots loués")}, rattachés à ${plural(mandantCount, "mandant", "mandants")}. Un lot appartient toujours à un seul mandat.`}
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv}>
              Exporter
            </Button>
            <Button asChild>
              <Link href={agenceRoutes.bienNew}>Ajouter un bien</Link>
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Lots sous mandat" value={lines.length}>
          <span className="text-caption text-fg-subtle">{`${String(rented)} loués, ${lines.length === rented ? "aucun vacant" : plural(lines.length - rented, "vacant", "vacants")}`}</span>
        </StatCard>
        <StatCard label="Loyers appelés" value={formatEuros(called)}>
          <span className="text-caption text-fg-subtle">charges comprises, par mois</span>
        </StatCard>
        <StatCard label={`Encaissé en ${monthName(data.todayIso)}`} value={formatEuros(collected)}>
          <span className="text-caption text-fg-subtle">{`${String(called === 0 ? 0 : Math.round((collected / called) * 100))} % des loyers appelés`}</span>
        </StatCard>
        <StatCard label="Impayés" value={formatEuros(unpaid)} tone="danger">
          <span className="text-caption text-fg-subtle">{plural(counts.impayes, "lot", "lots")}</span>
        </StatCard>
      </div>
      <Tabs value={segment} defaultValue="tous" onValueChange={(next) => { setSegment(next as Segment); }}>
        <TabList aria-label="Segments de biens">
          <Tab value="tous" count={counts.tous}>Tous</Tab>
          <Tab value="payes" count={counts.payes}>Payés</Tab>
          <Tab value="impayes" count={counts.impayes}>Impayés</Tab>
          <Tab value="preavis" count={counts.preavis}>Préavis</Tab>
        </TabList>
        <TabPanel value={segment} className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <SearchField label="Rechercher un lot" placeholder="Lot, adresse, locataire, ex. : Apt 12" value={search} onChange={(event) => { setSearch(event.target.value); }} className="w-full sm:w-72" />
            <Select label="Mandant" placeholder="Tous" options={mandantOptions} value={mandantId} onValueChange={setMandantId} className="w-48" />
            <Select label="Ville" placeholder="Toutes" options={cityOptions} value={city} onValueChange={setCity} className="w-44" />
            <Chip pressed={overdueOnly} onClick={() => { setOverdueOnly((current) => !current); }}>Impayé</Chip>
            <Chip pressed={noticeOnly} onClick={() => { setNoticeOnly((current) => !current); }}>Préavis donné</Chip>
          </div>
          <DataList
            label="Liste des biens sous mandat"
            rows={filtered}
            columns={columns}
            rowKey={(line) => line.bien.id}
            resetKey={`${segment}|${search}|${mandantId}|${city}|${String(overdueOnly)}|${String(noticeOnly)}`}
            emptyTitle="Aucun lot ne correspond"
            emptyDescription="Modifiez la recherche ou retirez un filtre."
          />
        </TabPanel>
      </Tabs>
    </>
  );
}
