"use client";

import { Alert, Badge, Button, StatCard } from "@eguardimmo/ui";
import Link from "next/link";
import { formatDate, monthLabel, monthName, monthYearLabel } from "../data/dates";
import { pendingSettlement, rentState, settlementTotals, yearTotals } from "../data/derive";
import { useConfie } from "../data/queries";
import type { ConfieData, Settlement } from "../data/schemas";
import { eurFixed, percentOf } from "../data/money";
import { confieRoutes } from "../routes";
import { DataTable } from "../ui/DataTable";
import type { Column, TableRow } from "../ui/DataTable";
import { PageHeader } from "../ui/PageHeader";
import { SecondaryDownload } from "../ui/parts";
import { Caption, Section, StatGrid } from "../ui/Section";
import { QueryBoundary } from "../ui/States";

export function LoyersScreen() {
  const query = useConfie();
  return <QueryBoundary query={query}>{(data) => <Loyers data={data} />}</QueryBoundary>;
}

const dashIfZero = (amount: number) => (amount === 0 ? "—" : eurFixed(amount));

function Loyers({ data }: { data: ConfieData }) {
  const totals = yearTotals(data.settlements);
  const pending = pendingSettlement(data);
  const pendingReversed = pending ? settlementTotals(pending).reversed : 0;
  const overdueLots = data.lots.filter((lot) => rentState(lot, data.today).kind === "overdue");
  const first = data.settlements[0];
  const last = data.settlements.at(-1);
  const year = data.today.slice(0, 4);
  const ordered = [...data.settlements].reverse();

  const columns: Column<Settlement>[] = [
    { id: "month", header: "Mois", primary: true, cell: (settlement) => monthYearLabel(settlement.month) },
    { id: "called", header: "Appelé", align: "end", cell: (settlement) => eurFixed(settlementTotals(settlement).called) },
    { id: "collected", header: "Encaissé", align: "end", cell: (settlement) => eurFixed(settlementTotals(settlement).collected) },
    { id: "fees", header: "Honoraires", align: "end", cell: (settlement) => eurFixed(settlementTotals(settlement).fees) },
    { id: "works", header: "Travaux", align: "end", cell: (settlement) => dashIfZero(settlement.works) },
    { id: "reversed", header: "Reversé", align: "end", cell: (settlement) => eurFixed(settlementTotals(settlement).reversed) },
    {
      id: "state",
      header: "État",
      cell: (settlement) =>
        settlement.status === "paid" ? (
          <Badge tone="success">Reversé le {formatDate(settlement.reversedOn)}</Badge>
        ) : (
          <Badge tone="warning">À reverser le {formatDate(settlement.reversedOn)}</Badge>
        ),
    },
    {
      id: "action",
      header: "Action",
      action: true,
      cell: (settlement) => (
        <Button variant="link" size="sm" asChild>
          <Link href={confieRoutes.reversement(settlement.month)} aria-label={`Détail, ${monthYearLabel(settlement.month)}`}>Détail</Link>
        </Button>
      ),
    },
  ];
  const rows: TableRow<Settlement>[] = [
    ...ordered.map((settlement) => ({ key: settlement.month, value: settlement })),
    {
      kind: "total",
      key: "total",
      label: "Total",
      cells: {
        called: eurFixed(totals.called),
        collected: eurFixed(totals.collected),
        fees: eurFixed(totals.fees),
        works: eurFixed(totals.works),
        reversed: eurFixed(totals.reversed),
        state: <span className="text-caption font-normal text-fg-subtle">dont {eurFixed(totals.pending)} en attente</span>,
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Loyers et reversements"
        crumbs={[{ label: "Mon patrimoine" }, { label: "Loyers et reversements" }]}
        subtitle="Loyers appelés et encaissés par l'agence, honoraires et reversements sur votre compte, mois par mois."
        actions={<SecondaryDownload title={`Loyers et reversements ${year}`} label="Exporter en PDF" />}
      />
      {overdueLots[0] && pending ? (
        <Alert tone="warning" title={`${overdueLots[0].label}, loyer de ${monthName(data.today.slice(0, 7))} impayé`}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>Le reversement du {formatDate(pending.reversedOn)} est calculé sur les loyers encaissés à cette date : {eurFixed(pendingReversed)} aujourd&apos;hui.</span>
            <Button variant="secondary" size="sm" asChild><Link href={confieRoutes.bien(overdueLots[0].id)}>Voir le bien</Link></Button>
          </span>
        </Alert>
      ) : null}
      <StatGrid>
        <StatCard label={`Appelé en ${year}`} value={eurFixed(totals.called)}><Caption>{first && last ? `${monthLabel(first.month)} à ${monthName(last.month)}` : ""}</Caption></StatCard>
        <StatCard label={`Encaissé en ${year}`} value={eurFixed(totals.collected)}><Caption>{percentOf(totals.collected, totals.called)} % des loyers appelés</Caption></StatCard>
        <StatCard label={`Honoraires ${year}`} value={eurFixed(totals.fees)}><Caption>{data.mandate.feeRatePercent} % TTC des loyers encaissés</Caption></StatCard>
        <StatCard label={`Reversé en ${year}`} value={eurFixed(totals.reversedPaid)}><Caption>{eurFixed(totals.pending)} en attente</Caption></StatCard>
      </StatGrid>
      <Section title={`Année ${year}`}>
        <DataTable caption={`Loyers et reversements ${year}`} columns={columns} rows={rows} />
      </Section>
    </>
  );
}
