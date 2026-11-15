"use client";

import { Button, Chip, Select, StatCard, Tab, TabList, TabPanel, Tabs } from "@eguardimmo/ui";
import { CreditCard, Eye, Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ActionAlert } from "@/components/ui/ActionAlert";
import { DataList } from "@/components/ui/DataList";
import type { DataColumn } from "@/components/ui/DataList";
import { PageHeader } from "@/components/ui/PageHeader";
import { PillBadge } from "@/components/ui/PillBadge";
import { QueryState } from "@/components/ui/QueryState";
import { RowMenu } from "@/components/ui/RowMenu";
import { SearchField } from "@/components/ui/SearchField";
import { agenceRoutes, bienHref, locataireHref, mandantHref } from "@/espace/routes";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatDay } from "@/lib/dates";
import { formatEuros, formatEurosExact, formatEurosSigned } from "@/lib/money";
import { matchesQuery } from "@/lib/text";
import { locatairePill, plural } from "../labels";
import { usePortefeuille } from "../queries";
import { balanceMinor, bailSituation, calledMinor, overdueDays } from "../selectors";
import type { Portefeuille } from "../selectors";
import type { Bail, Bien, Locataire, Mandant } from "../schemas";

interface TenantLine {
  tenant: Locataire;
  bail: Bail | undefined;
  bien: Bien | undefined;
  mandant: Mandant | undefined;
}

type Segment = "tous" | "a_jour" | "impayes" | "preavis" | "archives";
const SEGMENTS: readonly Segment[] = ["tous", "a_jour", "impayes", "preavis", "archives"];

const BALANCE_OPTIONS = [
  { value: "tous", label: "Tous" },
  { value: "a_jour", label: "À jour" },
  { value: "impaye", label: "Impayé" },
];

export function LocatairesPage() {
  const query = usePortefeuille();
  return (
    <QueryState query={query} label="La liste des locataires">
      {(index) => <Locataires index={index} />}
    </QueryState>
  );
}

function lineOf(index: Portefeuille, tenant: Locataire): TenantLine {
  const current = index.currentBailOf(tenant.id);
  const past = index.data.baux.filter((bail) => bail.locataireId === tenant.id && bail.status === "termine").sort((a, b) => (a.endIso < b.endIso ? 1 : -1))[0];
  const bail = current ?? past;
  const bien = bail ? index.bien(bail.bienId) : undefined;
  return { tenant, bail, bien, mandant: bien ? index.mandantOfBien(bien) : undefined };
}

function Locataires({ index }: { index: Portefeuille }) {
  const { data } = index;
  const params = useSearchParams();
  const requested = params.get("situation");
  const [segment, setSegment] = useState<Segment>(requested === "impaye" ? "impayes" : (SEGMENTS.find((item) => item === requested) ?? "tous"));
  const [search, setSearch] = useState("");
  const [mandantId, setMandantId] = useState("tous");
  const [balance, setBalance] = useState("tous");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [noticeOnly, setNoticeOnly] = useState(false);

  const all = useMemo(() => data.locataires.map((tenant) => lineOf(index, tenant)), [data, index]);
  const current = all.filter((line) => line.bail?.status === "en_cours");
  const archived = all.filter((line) => line.tenant.archived);
  const situationOf = (line: TenantLine) => (line.bail?.status === "en_cours" ? bailSituation(line.bail) : "a_jour");
  const overdue = current.filter((line) => situationOf(line) === "impaye");
  const counts = {
    tous: current.length,
    a_jour: current.filter((line) => situationOf(line) !== "impaye").length,
    impayes: overdue.length,
    preavis: current.filter((line) => situationOf(line) === "preavis").length,
    archives: archived.length,
  };
  const owed = overdue.reduce((sum, line) => sum - (line.bail ? balanceMinor(line.bail) : 0), 0);
  const worst = [...overdue].sort((a, b) => (b.bail ? overdueDays(b.bail, data.todayIso) : 0) - (a.bail ? overdueDays(a.bail, data.todayIso) : 0));

  const base = segment === "archives" ? archived : current;
  const mandantOptions = [{ value: "tous", label: "Tous" }, ...data.mandants.filter((item) => all.some((line) => line.mandant?.id === item.id)).map((item) => ({ value: item.id, label: item.name }))];

  const filtered = base.filter((line) => {
    const situation = situationOf(line);
    if (segment === "a_jour" && situation === "impaye") return false;
    if (segment === "impayes" && situation !== "impaye") return false;
    if (segment === "preavis" && situation !== "preavis") return false;
    if (overdueOnly && situation !== "impaye") return false;
    if (noticeOnly && situation !== "preavis") return false;
    if (balance === "a_jour" && situation === "impaye") return false;
    if (balance === "impaye" && situation !== "impaye") return false;
    if (mandantId !== "tous" && line.mandant?.id !== mandantId) return false;
    return matchesQuery(search, line.tenant.name, line.bien?.name ?? "", line.mandant?.name ?? "");
  });

  const columns: DataColumn<TenantLine>[] = [
    {
      id: "tenant",
      header: "Locataire",
      strong: true,
      cell: ({ tenant, bail }) => (
        <>
          <Link href={locataireHref(tenant.id)} className="hover:underline">
            {tenant.name}
          </Link>
          <span className="block text-caption font-normal text-fg-subtle">{bail ? `${tenant.archived ? "Parti le" : "Locataire depuis le"} ${formatDay(tenant.archived ? bail.endIso : bail.startIso)}` : "Sans bail"}</span>
        </>
      ),
    },
    {
      id: "lot",
      header: "Lot",
      cell: ({ bien }) =>
        bien ? (
          <Link href={bienHref(bien.id)} className="hover:underline">
            {bien.name}
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
    { id: "rent", header: "Loyer charges comprises", numeric: true, cell: ({ bail }) => (bail ? formatEurosExact(calledMinor(bail)) : "—") },
    {
      id: "balance",
      header: "Solde",
      numeric: true,
      cell: ({ bail }) => {
        const amount = bail?.status === "en_cours" ? balanceMinor(bail) : 0;
        return <span className={amount < 0 ? "font-semibold text-fg-danger" : undefined}>{amount === 0 ? formatEurosExact(0) : formatEurosSigned(amount).replace("-", "−")}</span>;
      },
    },
    {
      id: "state",
      header: "Situation",
      cell: ({ tenant, bail }) => <PillBadge pill={tenant.archived ? { tone: "neutral", label: "Archivé" } : locatairePill(bail, data.todayIso)} />,
    },
    {
      id: "action",
      header: "Action",
      cell: ({ tenant }) => (
        <span className="flex items-center gap-1">
          <Button variant="link" size="sm" asChild>
            <Link href={locataireHref(tenant.id)} aria-label={`Ouvrir la fiche de ${tenant.name}`}>
              Ouvrir
            </Link>
          </Button>
          <RowMenu
            label={`Actions pour ${tenant.name}`}
            items={[
              { id: "fiche", label: "Voir la fiche", icon: Eye, href: locataireHref(tenant.id) },
              { id: "ecrire", label: "Écrire", icon: Mail, href: agenceRoutes.messageNew },
              ...(tenant.archived ? [] : [{ id: "paiement", label: "Enregistrer un paiement", icon: CreditCard, href: agenceRoutes.encaissementNew }]),
            ]}
          />
        </span>
      ),
    },
  ];

  const exportCsv = () => {
    downloadCsv(
      "locataires.csv",
      toCsv(
        ["Locataire", "Lot", "Mandant", "Loyer charges comprises (€)", "Solde (€)", "Situation"],
        filtered.map((line) => [
          line.tenant.name,
          line.bien?.name ?? "",
          line.mandant?.name ?? "",
          line.bail ? (calledMinor(line.bail) / 100).toFixed(2) : "",
          line.bail?.status === "en_cours" ? (balanceMinor(line.bail) / 100).toFixed(2) : "0.00",
          line.tenant.archived ? "Archivé" : locatairePill(line.bail, data.todayIso).label,
        ]),
      ),
    );
  };

  return (
    <>
      <PageHeader
        title="Locataires"
        description={`${plural(current.length, "locataire", "locataires")}, un par lot. Vous ne voyez que les locataires des biens que vos mandants vous ont confiés.`}
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv}>
              Exporter
            </Button>
            <Button asChild>
              <Link href="/locataires/invitation">Inviter un locataire</Link>
            </Button>
          </>
        }
      />

      {overdue.length > 0 ? (
        <ActionAlert
          tone="danger"
          title={`${plural(overdue.length, "locataire en retard", "locataires en retard")} de paiement, ${formatEuros(owed)} au total`}
          action={
            <Button variant="secondary" size="sm" asChild>
              <Link href={agenceRoutes.impayes}>Voir les impayés</Link>
            </Button>
          }
        >
          {worst.map((line) => `${line.tenant.name} depuis ${plural(line.bail ? overdueDays(line.bail, data.todayIso) : 0, "jour", "jours")}`).join(", ")}.
        </ActionAlert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Locataires" value={current.length}>
          <span className="text-caption text-fg-subtle">{plural(counts.preavis, "préavis donné", "préavis donnés")}</span>
        </StatCard>
        <StatCard label="À jour" value={counts.a_jour}>
          <span className="text-caption text-fg-subtle">loyer du mois encaissé</span>
        </StatCard>
        <StatCard label="Solde dû" value={formatEuros(owed)} tone={owed > 0 ? "danger" : "default"}>
          <span className="text-caption text-fg-subtle">{plural(overdue.length, "locataire", "locataires")}</span>
        </StatCard>
      </div>

      <Tabs value={segment} defaultValue="tous" onValueChange={(next) => { setSegment(next as Segment); }}>
        <TabList aria-label="Segments de locataires">
          <Tab value="tous" count={counts.tous}>Tous</Tab>
          <Tab value="a_jour" count={counts.a_jour}>À jour</Tab>
          <Tab value="impayes" count={counts.impayes}>Impayés</Tab>
          <Tab value="preavis" count={counts.preavis}>Préavis</Tab>
          <Tab value="archives" count={counts.archives}>Archivés</Tab>
        </TabList>
        <TabPanel value={segment} className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <SearchField label="Rechercher un locataire" placeholder="Nom, lot, ex. : Anaïs Roux" value={search} onChange={(event) => { setSearch(event.target.value); }} className="w-full sm:w-72" />
            <Select label="Mandant" placeholder="Tous" options={mandantOptions} value={mandantId} onValueChange={setMandantId} className="w-48" />
            <Select label="Solde" placeholder="Tous" options={BALANCE_OPTIONS} value={balance} onValueChange={setBalance} className="w-40" />
            <Chip pressed={overdueOnly} onClick={() => { setOverdueOnly((value) => !value); }}>Impayé</Chip>
            <Chip pressed={noticeOnly} onClick={() => { setNoticeOnly((value) => !value); }}>Préavis donné</Chip>
          </div>
          <DataList
            label="Liste des locataires"
            rows={filtered}
            columns={columns}
            rowKey={(line) => line.tenant.id}
            resetKey={`${segment}|${search}|${mandantId}|${balance}|${String(overdueOnly)}|${String(noticeOnly)}`}
            emptyTitle="Aucun locataire ne correspond"
            emptyDescription="Modifiez la recherche ou retirez un filtre."
          />
        </TabPanel>
      </Tabs>
    </>
  );
}
