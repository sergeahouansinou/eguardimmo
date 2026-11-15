"use client";

import { Badge, StatCard } from "@eguardimmo/ui";
import { FileText } from "lucide-react";
import { formatDate, monthYearLabel, ofMonth } from "../data/dates";
import { lotLabel, settlementTotals } from "../data/derive";
import { useConfie } from "../data/queries";
import type { ConfieData, Settlement, SettlementLine } from "../data/schemas";
import { eurFixed, eurSigned } from "../data/money";
import { confieRoutes } from "../routes";
import { DataList } from "../ui/DataList";
import { DataTable } from "../ui/DataTable";
import type { Column, TableRow } from "../ui/DataTable";
import { ListRow, RowList } from "../ui/ListRow";
import { PageHeader } from "../ui/PageHeader";
import { DownloadButton, PrimaryDownload } from "../ui/parts";
import { Caption, Section, Split, StatGrid } from "../ui/Section";
import { EmptyLine, NotFoundState, QueryBoundary } from "../ui/States";

export function ReversementScreen({ month }: { month: string }) {
  const query = useConfie();
  return (
    <QueryBoundary query={query}>
      {(data) => {
        const settlement = data.settlements.find((item) => item.month === month);
        return settlement ? <Reversement data={data} settlement={settlement} /> : <NotFoundState title="Reversement introuvable" backHref={confieRoutes.loyers} backLabel="Retour aux reversements" />;
      }}
    </QueryBoundary>
  );
}

function Reversement({ data, settlement }: { data: ConfieData; settlement: Settlement }) {
  const totals = settlementTotals(settlement);
  const paid = settlement.status === "paid";
  const title = `Reversement du ${formatDate(settlement.reversedOn)}`;
  const rate = data.mandate.feeRatePercent;
  const worksCount = settlement.works > 0 ? 1 : 0;

  const columns: Column<SettlementLine>[] = [
    { id: "lot", header: "Lot", primary: true, cell: (line) => lotLabel(data, line.lotId) },
    { id: "tenant", header: "Locataire", cell: (line) => data.lots.find((lot) => lot.id === line.lotId)?.tenant.name ?? "" },
    { id: "collected", header: "Encaissé", align: "end", cell: (line) => eurFixed(line.collected) },
    { id: "fees", header: "Honoraires", align: "end", cell: (line) => eurFixed(line.fees) },
    { id: "reversed", header: "Reversé", align: "end", cell: (line) => eurFixed(line.collected - line.fees) },
  ];
  const rows: TableRow<SettlementLine>[] = [
    ...settlement.lines.map((line) => ({ key: line.lotId, value: line })),
    {
      kind: "total",
      key: "total",
      label: "Total",
      cells: { collected: eurFixed(totals.collected), fees: eurFixed(totals.fees), reversed: eurFixed(totals.collected - totals.fees) },
    },
  ];

  return (
    <>
      <PageHeader
        title={title}
        crumbs={[{ label: "Loyers et reversements", href: confieRoutes.loyers }, { label: title }]}
        badges={<Badge tone={paid ? "success" : "warning"}>{paid ? "Versé" : "À reverser"}</Badge>}
        subtitle={`Loyers ${ofMonth(settlement.month)} ${settlement.month.slice(0, 4)} · mandat ${data.mandate.reference} · ${data.agency.name}`}
        actions={paid ? <PrimaryDownload title={`Relevé de reversement, ${monthYearLabel(settlement.month).toLowerCase()}`} label="Télécharger le relevé" /> : null}
      />
      <StatGrid>
        <StatCard label="Loyers encaissés" value={eurFixed(totals.collected)}><Caption>{monthYearLabel(settlement.month)}, {settlement.lines.length} lots</Caption></StatCard>
        <StatCard label="Honoraires" value={eurFixed(totals.fees)}><Caption>{rate} % TTC des loyers encaissés</Caption></StatCard>
        <StatCard label="Travaux" value={eurFixed(totals.works)}><Caption>{worksCount === 0 ? "Aucune intervention imputée" : "1 intervention imputée"}</Caption></StatCard>
        <StatCard label={paid ? "Virement reçu" : "Virement prévu"} value={eurFixed(totals.reversed)}><Caption>Le {formatDate(settlement.reversedOn)}</Caption></StatCard>
      </StatGrid>
      <Split>
        <Section title="Calcul du reversement">
          <dl className="flex flex-col text-body">
            {settlement.lines.map((line) => (
              <Line key={line.lotId} label={`Loyers encaissés, ${lotLabel(data, line.lotId)}`} value={eurFixed(line.collected)} />
            ))}
            <Line label={`Honoraires de gestion, ${String(rate)} % TTC`} value={eurSigned(totals.fees)} />
            <Line label="Travaux et frais refacturés" value={totals.works === 0 ? eurFixed(0) : eurSigned(totals.works)} />
            <Line label="Reversement" value={eurFixed(totals.reversed)} strong />
          </dl>
        </Section>
        <Section title="Virement">
          <DataList
            items={[
              { label: paid ? "Date" : "Date prévue", value: formatDate(settlement.reversedOn) },
              { label: "Montant", value: eurFixed(totals.reversed) },
              { label: "Bénéficiaire", value: data.profile.payout.holder },
              { label: "Compte", value: `IBAN •••• ${data.profile.payout.ibanLast4}` },
              { label: "Référence", value: settlement.reference },
            ]}
          />
        </Section>
      </Split>
      <Section title="Détail par lot">
        <DataTable caption={`Détail par lot, ${title}`} columns={columns} rows={rows} />
      </Section>
      <Section title="Pièces associées">
        {paid ? (
          <RowList label="Pièces associées">
            <ListRow icon={FileText} title={`Relevé de reversement, ${monthYearLabel(settlement.month).toLowerCase()}`} detail={`PDF · ${formatDate(settlement.reversedOn)}`} trailing={<DownloadButton title={`Relevé de reversement, ${monthYearLabel(settlement.month).toLowerCase()}`} />} />
            <ListRow icon={FileText} title={`Facture d'honoraires, ${monthYearLabel(settlement.month).toLowerCase()}`} detail={`PDF · ${eurFixed(totals.fees)} TTC · ${formatDate(settlement.reversedOn)}`} trailing={<DownloadButton title={`Facture d'honoraires, ${monthYearLabel(settlement.month).toLowerCase()}`} />} />
          </RowList>
        ) : (
          <EmptyLine>Les pièces seront disponibles après le virement du {formatDate(settlement.reversedOn)}.</EmptyLine>
        )}
      </Section>
    </>
  );
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between gap-3 border-t border-line pt-2 font-semibold text-fg" : "flex justify-between gap-3 py-1 text-fg-muted"}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
