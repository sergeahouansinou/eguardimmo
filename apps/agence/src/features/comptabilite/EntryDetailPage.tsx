"use client";

import { Alert, Badge } from "@eguardimmo/ui";
import Link from "next/link";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { SectionCard } from "@/components/ui/SectionCard";
import { DataTable, DetailList, PageFrame } from "@/features/kit";
import type { Column } from "@/features/kit";
import { OrgApiError } from "@/features/org/errors";
import { formatMoney } from "@/features/org/format";
import { LoadingPanel, QueryFailure } from "@/features/org/QueryBoundary";
import type { Money } from "@/features/org/schemas";
import { formatDate, formatDateTime } from "@/features/shared/dates";
import { useEntry } from "./hooks";
import { JOURNAL_LABELS, accountRoleLabel, sourceLabel } from "./labels";
import { comptabilitePaths, entryHref, statementHref } from "./paths";
import type { EntryDetail, EntryLine } from "./schemas";

const isZero = (money: Money): boolean => money.amount === 0;

const COLUMNS: readonly Column<EntryLine>[] = [
  { id: "account", header: "Compte", role: "title", cell: (line) => `${line.account.code} ${line.account.label}` },
  { id: "nature", header: "Nature", cell: (line) => accountRoleLabel(line.account.role) },
  {
    id: "lease",
    header: "Bail",
    cell: (line) =>
      line.leaseId === null ? (
        ""
      ) : (
        <Link href={statementHref(line.leaseId)} className="inline-flex min-h-11 items-center text-action-on-subtle underline underline-offset-2">
          Relevé du bail
        </Link>
      ),
  },
  { id: "debit", header: "Débit", numeric: true, cell: (line) => (isZero(line.debit) ? "" : formatMoney(line.debit)) },
  { id: "credit", header: "Crédit", numeric: true, cell: (line) => (isZero(line.credit) ? "" : formatMoney(line.credit)) },
];

function totals(lines: readonly EntryLine[]): Record<string, string> | undefined {
  const currencies = new Set(lines.map((line) => line.debit.currency));
  const [currency] = [...currencies];
  if (currencies.size !== 1 || currency === undefined) return undefined;
  const debit = lines.reduce((sum, line) => sum + line.debit.amount, 0);
  const credit = lines.reduce((sum, line) => sum + line.credit.amount, 0);
  return { debit: formatMoney({ amount: debit, currency }), credit: formatMoney({ amount: credit, currency }) };
}

function EntryContent({ entry }: { entry: EntryDetail }) {
  const footer = totals(entry.lines);
  return (
    <>
      {entry.reversalOfId === null ? null : (
        <Alert tone="warning" title="Contre-passation">
          Cette écriture annule l’écriture{" "}
          <Link href={entryHref(entry.reversalOfId)} className="text-action-on-subtle underline underline-offset-2">
            qu’elle contre-passe
          </Link>
          .
        </Alert>
      )}
      <SectionCard title="Pièce comptable">
        <DetailList
          items={[
            { label: "Date", value: formatDate(entry.date) },
            { label: "Journal", value: <Badge>{JOURNAL_LABELS[entry.journal]}</Badge> },
            { label: "Libellé", value: entry.label },
            { label: "Origine", value: sourceLabel(entry.sourceType) },
            { label: "Comptabilisée le", value: formatDateTime(entry.postedAt) },
          ]}
        />
      </SectionCard>
      <SectionCard title="Lignes de l’écriture">
        <DataTable caption="Lignes de l’écriture" columns={COLUMNS} rows={entry.lines} getRowId={(line) => line.id} footerLabel="Total" {...(footer ? { footer } : {})} />
      </SectionCard>
    </>
  );
}

export function EntryDetailPage({ id }: { id: string }) {
  const query = useEntry(id);
  const crumbs = [{ label: "Finances" }, { label: "Comptabilité", href: comptabilitePaths.accounts }, { label: "Écritures", href: comptabilitePaths.entries }, { label: query.data?.reference ?? "Écriture" }];
  if (query.error instanceof OrgApiError && query.error.kind === "not_found") {
    return <NotFoundState title="Écriture introuvable" description={query.error.message} backHref={comptabilitePaths.entries} backLabel="Retour aux écritures" />;
  }
  return (
    <PageFrame crumbs={crumbs} title={query.data ? `Écriture ${query.data.reference}` : "Écriture"} description="Une écriture comptabilisée ne se modifie pas et ne se supprime pas.">
      {query.isError ? <QueryFailure error={query.error} label="L’écriture" onRetry={query.refetch} /> : query.data === undefined ? <LoadingPanel label="L’écriture" /> : <EntryContent entry={query.data} />}
    </PageFrame>
  );
}
