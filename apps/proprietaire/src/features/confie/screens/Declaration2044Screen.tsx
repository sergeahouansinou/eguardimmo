"use client";

import { Alert, Badge, IconButton } from "@eguardimmo/ui";
import { Copy } from "lucide-react";
import { formatDate } from "../data/dates";
import { declaration2044 } from "../data/fiscal";
import type { DeclarationLine } from "../data/fiscal";
import { useConfie } from "../data/queries";
import type { ConfieData } from "../data/schemas";
import { eurFixed } from "../data/money";
import { confieRoutes } from "../routes";
import { DataList } from "../ui/DataList";
import { DataTable } from "../ui/DataTable";
import type { Column, TableRow } from "../ui/DataTable";
import { PageHeader } from "../ui/PageHeader";
import { PrimaryDownload } from "../ui/parts";
import { Caption, Section, Split } from "../ui/Section";
import { QueryBoundary } from "../ui/States";
import { useToast } from "../ui/Toast";

export function Declaration2044Screen() {
  const query = useConfie();
  return <QueryBoundary query={query}>{(data) => <Declaration data={data} />}</QueryBoundary>;
}

const plainAmount = (cents: number) => `${String(Math.trunc(cents / 100))},${String(Math.abs(cents % 100)).padStart(2, "0")}`;

function Declaration({ data }: { data: ConfieData }) {
  const { notify } = useToast();
  const declaration = declaration2044(data.fiscal);
  const year = String(data.fiscal.year);
  const nextReport = data.reports.find((report) => report.status === "upcoming");

  const copy = async (line: DeclarationLine) => {
    try {
      await navigator.clipboard.writeText(plainAmount(line.amount));
      notify(`Montant de la ligne ${line.line} copié : ${plainAmount(line.amount)}`);
    } catch {
      notify(`Copie impossible. Saisissez ${plainAmount(line.amount)} à la main dans la ligne ${line.line}.`, "danger");
    }
  };

  const columns: Column<DeclarationLine>[] = [
    { id: "line", header: "Ligne", primary: true, cell: (line) => <span className="inline-flex h-6 min-w-10 items-center justify-center rounded-sm bg-action-subtle px-1.5 text-caption font-semibold text-action-on-subtle">{line.line}</span> },
    { id: "label", header: "Intitulé", cell: (line) => <>{line.label}<br /><Caption>{line.detail}</Caption></> },
    { id: "amount", header: "Montant", align: "end", cell: (line) => <span className={line.total ? "font-semibold" : undefined}>{eurFixed(line.amount)}</span> },
    {
      id: "copy",
      header: "Copier",
      action: true,
      cell: (line) => <IconButton label={`Copier le montant de la ligne ${line.line}`} icon={Copy} onClick={() => { void copy(line); }} />,
    },
  ];
  const toRows = (lines: DeclarationLine[]): TableRow<DeclarationLine>[] => lines.map((line) => ({ key: line.line, value: line }));
  const rows: TableRow<DeclarationLine>[] = [
    { kind: "group", key: "g1", label: "Recettes" },
    ...toRows(declaration.revenue),
    { kind: "group", key: "g2", label: "Frais et charges" },
    ...toRows(declaration.charges),
    { kind: "group", key: "g3", label: "Intérêts d'emprunt" },
    ...toRows(declaration.interest),
  ];

  return (
    <>
      <PageHeader
        title="Aide à la déclaration 2044"
        crumbs={[{ label: "Fiscalité", href: confieRoutes.fiscalite }, { label: "Déclaration 2044" }]}
        badges={<Badge tone="warning">Montants provisoires</Badge>}
        subtitle={`Revenus fonciers ${year}, régime ${data.fiscal.regime === "reel" ? "réel" : "micro-foncier"}. Reportez ces montants dans votre déclaration en ligne.`}
        actions={<PrimaryDownload title={`Synthèse déclaration 2044, ${year}`} label="Télécharger la synthèse" />}
      />
      <Alert tone="info" title={`${data.profile.denomination}, société à l'impôt sur le revenu`}>
        La société dépose la déclaration 2072, puis chaque associé reporte sa quote-part sur sa 2044. Les montants ci-dessous sont à 100 %.
      </Alert>
      <Split>
        <Section title="Lignes à reporter">
          <DataTable caption="Lignes à reporter dans la déclaration 2044" columns={columns} rows={rows} />
        </Section>
        <div className="flex flex-col gap-3">
          <Section title="Résultat">
            <DataList
              width="lg"
              items={[
                { label: "Recettes", value: eurFixed(declaration.totals.revenue) },
                { label: "Frais et charges", value: eurFixed(declaration.totals.charges) },
                { label: "Intérêts", value: eurFixed(declaration.totals.interest) },
                { label: "Revenu foncier net", value: <b>{eurFixed(declaration.totals.result)}</b> },
              ]}
            />
          </Section>
          <Section title="Comment l'utiliser">
            <p className="text-body text-fg-muted">
              Copiez chaque montant avec l&apos;icône à droite de la ligne, puis collez-le dans la case du même numéro. Les numéros de ligne suivent le formulaire de l&apos;année en cours.
            </p>
            {nextReport ? <Caption>Mise à jour finale le {formatDate(nextReport.availableOn)}, avec les loyers de décembre.</Caption> : null}
          </Section>
        </div>
      </Split>
    </>
  );
}
