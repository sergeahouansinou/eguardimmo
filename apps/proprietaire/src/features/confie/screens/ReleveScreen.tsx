"use client";

import { useState } from "react";
import { formatDate } from "../data/dates";
import { monthPeriod } from "../data/period";
import type { Period } from "../data/period";
import { useConfie } from "../data/queries";
import type { ConfieData } from "../data/schemas";
import { buildStatement } from "../data/statement";
import { confieRoutes } from "../routes";
import { PageHeader } from "../ui/PageHeader";
import { SecondaryDownload } from "../ui/parts";
import { PeriodForm } from "../ui/PeriodForm";
import { Section } from "../ui/Section";
import { QueryBoundary } from "../ui/States";
import { StatementView } from "../ui/StatementView";

export function ReleveScreen() {
  const query = useConfie();
  return <QueryBoundary query={query}>{(data) => <Releve data={data} />}</QueryBoundary>;
}

function Releve({ data }: { data: ConfieData }) {
  const [period, setPeriod] = useState<Period>(() => monthPeriod(new Date(`${data.today}T12:00:00`)));
  const statement = buildStatement(data, period);
  return (
    <>
      <PageHeader
        title="Relevé de compte"
        subtitle={`${data.profile.denomination} · compte de votre mandat chez ${data.agency.name}`}
        crumbs={[{ label: "Accueil", href: confieRoutes.home }, { label: "Relevé de compte" }]}
      />
      <Section
        title="Période"
        aside={<SecondaryDownload title={`Relevé de compte du ${formatDate(period.from)} au ${formatDate(period.to)}`} label="Exporter en CSV" />}
      >
        <PeriodForm legend="Période du relevé" initial={period} onApply={setPeriod} />
      </Section>
      <StatementView
        openingLabel={`Solde au ${formatDate(period.from)}, avant mouvements`}
        closingLabel={`Solde au ${formatDate(period.to)}`}
        opening={statement.opening}
        closing={statement.closing}
        caption={`Relevé de compte du ${formatDate(period.from)} au ${formatDate(period.to)}`}
        rows={statement.rows}
      />
    </>
  );
}
