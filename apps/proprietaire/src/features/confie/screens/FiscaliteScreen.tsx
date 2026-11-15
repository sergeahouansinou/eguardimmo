"use client";

import { Badge, Button, StatCard } from "@eguardimmo/ui";
import { CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { formatDate, monthLabel, monthName } from "../data/dates";
import { useConfie } from "../data/queries";
import { fiscalSummary } from "../data/fiscal";
import type { ConfieData, FiscalLine } from "../data/schemas";
import { eur, eurFixed } from "../data/money";
import { confieRoutes } from "../routes";
import { DataList } from "../ui/DataList";
import { DataTable } from "../ui/DataTable";
import type { Column, TableRow } from "../ui/DataTable";
import { ListRow, RowList } from "../ui/ListRow";
import { PageHeader } from "../ui/PageHeader";
import { SecondaryDownload } from "../ui/parts";
import { Caption, Section, Split, StatGrid } from "../ui/Section";
import { QueryBoundary } from "../ui/States";

export function FiscaliteScreen() {
  const query = useConfie();
  return <QueryBoundary query={query}>{(data) => <Fiscalite data={data} />}</QueryBoundary>;
}

function Fiscalite({ data }: { data: ConfieData }) {
  const { fiscal } = data;
  const summary = fiscalSummary(fiscal);
  const year = String(fiscal.year);
  const first = data.settlements[0];
  const last = data.settlements.at(-1);

  const columns: Column<FiscalLine>[] = [
    { id: "label", header: "Rubrique", primary: true, cell: (line) => line.label },
    { id: "amount", header: "Montant", align: "end", cell: (line) => eurFixed(line.amount) },
    { id: "origin", header: "Origine", cell: (line) => line.origin },
  ];
  const rows: TableRow<FiscalLine>[] = [
    { kind: "group", key: "g-recettes", label: "Recettes" },
    ...fiscal.lines.filter((line) => line.group === "recettes").map((line) => ({ key: line.id, value: line })),
    { kind: "group", key: "g-charges", label: "Charges déductibles" },
    ...fiscal.lines.filter((line) => line.group === "charges").map((line) => ({ key: line.id, value: line })),
    { kind: "total", key: "t-charges", label: "Total des charges", cells: { amount: eurFixed(summary.totalCharges) } },
    { kind: "total", key: "t-result", label: "Résultat foncier", cells: { amount: eurFixed(summary.result), origin: "Loyers moins charges" } },
  ];

  return (
    <>
      <PageHeader
        title={`Fiscalité, revenus fonciers ${year}`}
        crumbs={[{ label: "Mon patrimoine" }, { label: "Fiscalité" }]}
        badges={<Badge tone="warning">Année en cours</Badge>}
        subtitle={`Récapitulatif au ${formatDate(fiscal.asOf)} : loyers encaissés par l'agence et charges déductibles connues. Les loyers de ${monthName(`${year}-12`)} s'ajouteront.`}
        actions={
          <>
            <SecondaryDownload title={`Revenus fonciers ${year}`} label="Exporter en PDF" />
            <Button asChild><Link href={confieRoutes.declaration}>Préparer la déclaration 2044</Link></Button>
          </>
        }
      />
      <StatGrid>
        <StatCard label="Loyers encaissés" value={eurFixed(summary.revenue)}><Caption>{first && last ? `${monthLabel(first.month)} à ${monthName(last.month)} ${year}` : year}</Caption></StatCard>
        <StatCard label="Charges déductibles" value={eurFixed(summary.totalCharges)}><Caption>Dont {eurFixed(summary.interest)} d&apos;intérêts d&apos;emprunt</Caption></StatCard>
        <StatCard label="Résultat foncier" value={eurFixed(summary.result)}><Caption>Loyers moins charges</Caption></StatCard>
        <StatCard label="Régime" value={fiscal.regime === "reel" ? "Réel" : "Micro-foncier"}><Caption>{summary.realIsBetter ? "Plus favorable que le micro-foncier" : "Le réel est moins favorable"}</Caption></StatCard>
      </StatGrid>
      <Split>
        <Section title={`Récapitulatif ${year}`}>
          <DataTable caption={`Récapitulatif fiscal ${year}`} columns={columns} rows={rows} />
        </Section>
        <div className="flex flex-col gap-3">
          <Section title="Régime fiscal">
            <DataList
              width="lg"
              items={[
                { label: "Régime", value: fiscal.regime === "reel" ? "Réel" : "Micro-foncier" },
                { label: "Revenu imposable", value: eurFixed(summary.result) },
                { label: "Micro-foncier", value: eurFixed(summary.microTaxable) },
                { label: "Déclaration", value: "Formulaire 2044" },
              ]}
            />
            <Caption>
              Le micro-foncier appliquerait un abattement de {fiscal.microAllowancePercent} % sur {eur(summary.revenue)}.{" "}
              {summary.realIsBetter ? "Le réel reste plus favorable." : "Le micro-foncier serait plus favorable."}
            </Caption>
          </Section>
          <Section title="Justificatifs">
            <RowList label="Justificatifs">
              {fiscal.proofs.map((proof) => (
                <ListRow key={proof.id} icon={proof.tone === "success" ? CircleCheck : TriangleAlert} tone={proof.tone} title={proof.title} detail={proof.detail} trailing={proof.badge ? <Badge tone={proof.tone}>{proof.badge}</Badge> : undefined} />
              ))}
            </RowList>
          </Section>
        </div>
      </Split>
    </>
  );
}
