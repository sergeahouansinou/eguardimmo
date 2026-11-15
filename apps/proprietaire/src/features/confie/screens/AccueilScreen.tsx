"use client";

import { Alert, Badge, Button, Icon, StatCard } from "@eguardimmo/ui";
import { CircleCheck, FileText, MessageSquare, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { daysBetween, formatDate, monthName, ofMonth, plural } from "../data/dates";
import {
  lastPaidSettlement,
  latestReport,
  lotTotalRent,
  pendingSettlement,
  rentState,
  settlementTotals,
  sum,
} from "../data/derive";
import { useConfie } from "../data/queries";
import type { ConfieData } from "../data/schemas";
import { eur, eurFixed } from "../data/money";
import { confieRoutes } from "../routes";
import { DataList } from "../ui/DataList";
import type { Column, TableRow } from "../ui/DataTable";
import { DataTable } from "../ui/DataTable";
import { ListRow, RowList } from "../ui/ListRow";
import { DownloadButton, PrimaryDownload, RentStateBadge, TextLink } from "../ui/parts";
import { PageHeader } from "../ui/PageHeader";
import { QueryBoundary } from "../ui/States";
import { Caption, Pair, Section, Split, StatGrid } from "../ui/Section";

const FEATURED_DOCUMENTS = ["mandat-m-2025-0142", "attestation-assurance", "avis-taxe-fonciere-2026"];

export function AccueilScreen() {
  const query = useConfie();
  return <QueryBoundary query={query}>{(data) => <Accueil data={data} />}</QueryBoundary>;
}

interface LotRow {
  id: string;
  label: string;
  kind: string;
  surface: number;
  tenant: string;
  rent: number;
  collected: number;
  state: ReturnType<typeof rentState>;
}

function Accueil({ data }: { data: ConfieData }) {
  const report = latestReport(data);
  const pending = pendingSettlement(data);
  const lastPaid = lastPaidSettlement(data);
  const rows: LotRow[] = data.lots.map((lot) => {
    const state = rentState(lot, data.today);
    return { id: lot.id, label: lot.label, kind: lot.kind, surface: lot.surface, tenant: lot.tenant.name, rent: lotTotalRent(lot), collected: state.collected, state };
  });
  const called = sum(rows.map((row) => row.state.called));
  const collected = sum(rows.map((row) => row.collected));
  const overdue = rows.flatMap((row) => (row.state.kind === "overdue" ? [row.state] : []));
  const arrears = sum(overdue.map((state) => state.called - state.collected));
  const longest = Math.max(0, ...overdue.map((state) => state.days));
  const pendingTotals = pending ? settlementTotals(pending) : null;
  const lastTotals = lastPaid ? settlementTotals(lastPaid) : null;
  const month = monthName(data.today.slice(0, 7));
  const paidSettlements = data.settlements.filter((settlement) => settlement.status === "paid").slice(-3).reverse();

  const columns: Column<LotRow>[] = [
    { id: "lot", header: "Lot", primary: true, cell: (row) => <><Link href={confieRoutes.bien(row.id)} className="underline-offset-3 hover:underline">{row.label}</Link><br /><Caption>{row.kind}, {row.surface} m²</Caption></> },
    { id: "tenant", header: "Locataire", cell: (row) => row.tenant },
    { id: "rent", header: "Loyer charges comprises", align: "end", cell: (row) => eur(row.rent) },
    { id: "collected", header: `Encaissé en ${month}`, align: "end", cell: (row) => <span className={row.state.kind === "overdue" ? "font-semibold text-fg-danger" : undefined}>{eur(row.collected)}</span> },
    { id: "state", header: "État", cell: (row) => <RentStateBadge state={row.state} /> },
  ];
  const tableRows: TableRow<LotRow>[] = rows.map((row) => ({ key: row.id, value: row }));
  const featured = FEATURED_DOCUMENTS.flatMap((id) => data.documents.find((document) => document.id === id) ?? []);

  return (
    <>
      <PageHeader
        title={`Bonjour ${data.profile.firstName}`}
        subtitle={`${data.profile.denomination} · ${String(data.lots.length)} lots gérés par ${data.agency.name}, mandat n° ${data.mandate.reference}`}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href={confieRoutes.messageNouveau}><Icon icon={MessageSquare} />Écrire à l&apos;agence</Link>
            </Button>
            {report ? <PrimaryDownload title={`Compte rendu de gestion, ${report.label}`} label="Télécharger le compte rendu" /> : null}
          </>
        }
      />
      {report?.status === "new" ? (
        <Alert tone="info" title={`Compte rendu de gestion, ${report.longLabel}`}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>Disponible depuis le {formatDate(report.availableOn)}. Il détaille les loyers, les honoraires et les reversements.</span>
            <Button variant="secondary" size="sm" asChild><Link href={confieRoutes.compteRendu(report.id)}>Ouvrir</Link></Button>
          </span>
        </Alert>
      ) : null}
      <StatGrid>
        <StatCard label={`Loyers encaissés, ${month}`} value={eur(collected)}><Caption>sur {eur(called)} appelés</Caption></StatCard>
        <StatCard label="Impayés" tone={arrears > 0 ? "danger" : "default"} value={eur(arrears)}>
          <Caption>{overdue.length === 0 ? "Aucun impayé" : `${plural(overdue.length, "locataire")}, ${plural(longest, "jour")} de retard`}</Caption>
        </StatCard>
        <StatCard label="Reversement en attente" value={eurFixed(pendingTotals?.reversed ?? 0)}>
          <Caption>Après {eurFixed(pendingTotals?.fees ?? 0)} d&apos;honoraires</Caption>
        </StatCard>
        <StatCard label="Dernier reversement" value={eurFixed(lastTotals?.reversed ?? 0)}>
          <Caption>{lastPaid ? `Versé le ${formatDate(lastPaid.reversedOn)}` : "Aucun reversement"}</Caption>
        </StatCard>
      </StatGrid>
      <Split>
        <Section title="Mes biens" aside={<TextLink href={confieRoutes.biens}>Tout voir, {data.lots.length}</TextLink>}>
          <DataTable caption="Mes biens" columns={columns} rows={tableRows} />
        </Section>
        <Section title="Mon mandat" aside={<TextLink href={confieRoutes.mandat}>Voir le mandat</TextLink>}>
          <DataList
            width="sm"
            items={[
              { label: "Agence", value: data.agency.name },
              { label: "Mandat", value: data.mandate.reference },
              { label: "Honoraires", value: `${String(data.mandate.feeRatePercent)} % TTC des loyers` },
              { label: "Reversement", value: `Le ${String(data.mandate.payoutDay)} de chaque mois` },
              { label: "Échéance", value: formatDate(data.mandate.endOn) },
            ]}
          />
        </Section>
      </Split>
      <Pair>
        <Section title="Derniers reversements" aside={<TextLink href={confieRoutes.loyers}>Tout voir, {data.settlements.length}</TextLink>}>
          <RowList label="Derniers reversements">
            {paidSettlements.map((settlement) => {
              const totals = settlementTotals(settlement);
              return (
                <ListRow
                  key={settlement.month}
                  icon={CircleCheck}
                  tone="success"
                  title={<Link href={confieRoutes.reversement(settlement.month)} className="underline-offset-3 hover:underline">Reversement {ofMonth(settlement.month)}</Link>}
                  detail={`${formatDate(settlement.reversedOn)} · ${eurFixed(totals.collected)} encaissés, ${eurFixed(totals.fees)} d'honoraires`}
                  trailing={<b className="text-body-strong tabular-nums">{eurFixed(totals.reversed)}</b>}
                />
              );
            })}
          </RowList>
        </Section>
        <Section title="Mes documents" aside={<TextLink href={confieRoutes.documents}>Tout voir, {data.documents.length}</TextLink>}>
          <RowList label="Documents récents">
            {featured.map((document) => {
              const renewal = document.validUntil !== undefined && daysBetween(data.today, document.validUntil) <= 60;
              return (
                <ListRow
                  key={document.id}
                  icon={document.category === "assurance" ? ShieldCheck : FileText}
                  tone={renewal ? "warning" : "default"}
                  title={document.title}
                  detail={document.detail}
                  trailing={renewal ? <Badge tone="warning">À renouveler</Badge> : <DownloadButton title={document.title} />}
                />
              );
            })}
          </RowList>
        </Section>
      </Pair>
    </>
  );
}
