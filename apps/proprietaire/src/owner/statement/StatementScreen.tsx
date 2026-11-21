"use client";

import { ApiError } from "@eguardimmo/api";
import { Alert, EmptyState } from "@eguardimmo/ui";
import { Link2Off } from "lucide-react";
import { useState } from "react";
import { monthPeriod } from "@/features/confie/data/period";
import type { Period } from "@/features/confie/data/period";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { PeriodForm } from "@/features/confie/ui/PeriodForm";
import { Section } from "@/features/confie/ui/Section";
import { StatementView } from "@/features/confie/ui/StatementView";
import type { StatementRowView } from "@/features/confie/ui/StatementView";
import { confieRoutes } from "@/features/confie/routes";
import { agencyLabel, formatDay, formatMoney } from "../format";
import type { OwnerAccess } from "../model";
import { useOwnerSelection } from "../selection";
import { FailureNotice, Loading } from "../screens/FailureNotice";
import { AccessSelector } from "../screens/AccessSelector";
import { DownloadAction } from "../shared/DownloadAction";
import type { Money } from "../shared/model";
import { sourceLabel } from "./labels";
import type { OwnerStatement } from "./model";
import { useOwnerStatement } from "./queries";
import { statementCsvPath, statementFilename } from "./requests";

const ROLE_FORBIDDEN = "owner_role_forbidden";

export function CoOwnerNotice() {
  return (
    <Alert tone="info" title="Relevé non accessible en tant que co-indivisaire">
      Le compte du mandat concerne le titulaire et son représentant. En tant que co-indivisaire, vous consultez les biens, les baux et les comptes rendus, mais pas le relevé de compte.
    </Alert>
  );
}

const isRoleForbidden = (error: unknown): boolean => error instanceof ApiError && error.status === 403 && error.code === ROLE_FORBIDDEN;

function rowsOf(statement: OwnerStatement): StatementRowView[] {
  const signed = (money: Money): string | null => (money.amount === 0 ? null : formatMoney(money));
  return statement.lines.map((line, index) => ({
    key: `${line.date}-${line.reference}-${String(index)}`,
    date: formatDay(line.date),
    label: line.label,
    reference: line.reference,
    source: sourceLabel(line.source),
    reversal: line.isReversal,
    debit: signed(line.debit),
    credit: signed(line.credit),
    balance: formatMoney(line.balance),
  }));
}

function StatementBody({ access }: { access: OwnerAccess }) {
  const [period, setPeriod] = useState<Period>(() => monthPeriod());
  const query = useOwnerStatement(access.agencyId, period, true);
  const statement = query.data;
  return (
    <>
      <Section
        title="Période"
        aside={
          statement === undefined ? undefined : (
            <DownloadAction
              path={statementCsvPath(access.agencyId, period)}
              filename={statementFilename(access.mandantName, period)}
              format="any"
              label="Exporter en CSV"
              ariaLabel={`Exporter le relevé du ${formatDay(period.from)} au ${formatDay(period.to)} en CSV`}
            />
          )
        }
      >
        <PeriodForm legend="Période du relevé" initial={period} onApply={setPeriod} busy={query.isFetching} />
      </Section>
      {statement === undefined ? (
        query.isError ? (
          isRoleForbidden(query.error) ? (
            <CoOwnerNotice />
          ) : (
            <FailureNotice title="Le relevé n’a pas pu être chargé" error={query.error} onRetry={() => void query.refetch()} />
          )
        ) : (
          <Loading label="Chargement du relevé" rows={4} />
        )
      ) : (
        <StatementView
          openingLabel={`Solde au ${formatDay(statement.from)}, avant mouvements`}
          closingLabel={`Solde au ${formatDay(statement.to)}`}
          opening={formatMoney(statement.opening)}
          closing={formatMoney(statement.closing)}
          caption={`Relevé du compte de ${statement.mandantName} chez ${agencyLabel(access.agencyName)}, du ${formatDay(statement.from)} au ${formatDay(statement.to)}`}
          rows={rowsOf(statement)}
        />
      )}
    </>
  );
}

export function StatementScreen() {
  const { accesses, selected, select } = useOwnerSelection();
  return (
    <>
      <PageHeader
        title="Relevé de compte"
        subtitle={selected ? `${selected.mandantName} · ${agencyLabel(selected.agencyName)}` : "Aucun mandat relié à votre compte"}
        crumbs={[{ label: "Accueil", href: confieRoutes.home }, { label: "Relevé de compte" }]}
      />
      {selected === null ? (
        <EmptyState icon={Link2Off} title="Aucun accès à un mandat" description="Votre compte n’est relié à aucun mandat en cours : il n’y a pas de relevé à afficher." />
      ) : (
        <>
          {accesses.length > 1 ? <AccessSelector accesses={accesses} selected={selected} onSelect={select} /> : null}
          {selected.role === "co_owner" ? <CoOwnerNotice /> : <StatementBody access={selected} />}
        </>
      )}
    </>
  );
}
