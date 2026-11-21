"use client";

import { TaxIncomeView } from "@eguardimmo/gestion";
import { Alert, Button } from "@eguardimmo/ui";
import Link from "next/link";
import { confieRoutes } from "@/features/confie/routes";
import { PageHeader } from "@/features/confie/ui/PageHeader";
import { agencyLabel, formatOptionalDay } from "../format";
import { FailureNotice, Loading } from "../screens/FailureNotice";
import { DownloadAction } from "../shared/DownloadAction";
import { downloadName } from "../shared/download";
import { VALIDATION_NOTE } from "./labels";
import type { OwnerTaxStatementDetail } from "./model";
import { useTaxStatement } from "./queries";
import { taxStatementPdfPath } from "./requests";
import { TaxStatusBadge } from "./TaxStatementsScreen";

const crumbs = (title: string) => [{ label: "Fiscalité", href: confieRoutes.fiscalite }, { label: title }];

function Content({ statement }: { statement: OwnerTaxStatementDetail }) {
  const year = String(statement.incomeYear);
  return (
    <>
      <PageHeader
        title={`Revenus fonciers ${year}`}
        subtitle={`Relevé publié par ${agencyLabel(statement.agency.name)} le ${formatOptionalDay(statement.publishedAt)}`}
        badges={<TaxStatusBadge status={statement.status} />}
        crumbs={crumbs(year)}
        actions={
          statement.hasPdf ? (
            <DownloadAction path={taxStatementPdfPath(statement.id)} filename={downloadName(`releve-fiscal-${year}`, "application/pdf")} format="pdf" label="Télécharger le PDF" variant="primary" />
          ) : null
        }
      />
      {statement.status === "superseded" ? (
        <Alert tone="warning" title="Relevé remplacé">
          Votre agence a publié une version plus récente de ce relevé. Les chiffres ci-dessous sont ceux de cette version.
        </Alert>
      ) : null}
      {statement.supersedesId === null ? null : (
        <Button variant="link" size="sm" asChild className="self-start">
          <Link href={confieRoutes.fiscaliteReleve(statement.supersedesId)}>Voir la version remplacée</Link>
        </Button>
      )}
      <Alert tone="info" title="Aide à la déclaration">
        {VALIDATION_NOTE}
      </Alert>
      <TaxIncomeView income={statement.income} idPrefix="owner-tax" />
    </>
  );
}

export function TaxStatementScreen({ id }: { id: string }) {
  const query = useTaxStatement(id);
  if (query.data !== undefined) return <Content statement={query.data} />;
  if (!query.isError) return <Loading label="Chargement du relevé fiscal" />;
  return (
    <>
      <PageHeader title="Relevé fiscal" crumbs={crumbs("Relevé")} />
      <FailureNotice title="Ce relevé fiscal n’a pas pu être chargé" error={query.error} onRetry={() => void query.refetch()} />
      <div>
        <Button variant="secondary" asChild>
          <Link href={confieRoutes.fiscalite}>Retour aux relevés</Link>
        </Button>
      </div>
    </>
  );
}
