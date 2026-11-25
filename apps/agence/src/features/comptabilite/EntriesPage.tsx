"use client";

import { Alert, Button, EmptyState, Select, TextField } from "@eguardimmo/ui";
import { ScrollText } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { LinkButton, PageFrame } from "@/features/kit";
import { LoadingPanel, QueryFailure } from "@/features/org/QueryBoundary";
import { EntryTable } from "./EntryTable";
import { useEntries, useLeaseOptions } from "./hooks";
import { JOURNAL_LABELS } from "./labels";
import { comptabilitePaths } from "./paths";
import { JOURNALS } from "./schemas";
import type { EntryFilters, Journal } from "./schemas";

const ALL = "all";
const JOURNAL_OPTIONS = [{ value: ALL, label: "Tous les journaux" }, ...JOURNALS.map((journal) => ({ value: journal, label: JOURNAL_LABELS[journal] }))];

function journalOf(value: string): Journal | undefined {
  return JOURNALS.find((journal) => journal === value);
}

function filtersOf(values: { journal: string; lease: string; from: string; to: string }): EntryFilters {
  const journal = journalOf(values.journal);
  return {
    ...(journal === undefined ? {} : { journal }),
    ...(values.lease === ALL || values.lease === "" ? {} : { lease: values.lease }),
    ...(values.from === "" ? {} : { from: values.from }),
    ...(values.to === "" ? {} : { to: values.to }),
  };
}

export function EntriesPage() {
  const initialLease = useSearchParams().get("bail") ?? ALL;
  const [journal, setJournal] = useState(ALL);
  const [lease, setLease] = useState(initialLease);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const leases = useLeaseOptions();
  const periodError = from !== "" && to !== "" && to < from ? "La date de fin précède la date de début." : undefined;
  const filters = periodError === undefined ? filtersOf({ journal, lease, from, to }) : filtersOf({ journal, lease, from: "", to: "" });
  const entries = useEntries(filters);
  const leaseOptions = [{ value: ALL, label: "Tous les baux" }, ...(leases.data ?? []).map((option) => ({ value: option.id, label: option.label }))];
  const filtered = Object.keys(filters).length > 0;

  const reset = () => {
    setJournal(ALL);
    setLease(ALL);
    setFrom("");
    setTo("");
  };

  return (
    <PageFrame
      crumbs={[{ label: "Finances" }, { label: "Comptabilité", href: comptabilitePaths.accounts }, { label: "Écritures" }]}
      title="Écritures"
      description="Grand livre de l’agence, de la plus récente à la plus ancienne. Une écriture ne se modifie pas : on la contre-passe."
      actions={<LinkButton href={comptabilitePaths.statement}>Relevé de bail</LinkButton>}
    >
      <form
        aria-label="Filtrer les écritures"
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <Select label="Journal" placeholder="Tous les journaux" options={JOURNAL_OPTIONS} value={journal} onValueChange={setJournal} />
        <Select label="Bail" placeholder="Tous les baux" options={leaseOptions} value={lease} onValueChange={setLease} searchable searchPlaceholder="Rechercher un bail" disabled={leases.data === undefined} />
        <TextField label="Du" placeholder="AAAA-MM-JJ" type="date" value={from} onChange={(event) => { setFrom(event.target.value); }} />
        <TextField label="Au" placeholder="AAAA-MM-JJ" type="date" value={to} error={periodError} onChange={(event) => { setTo(event.target.value); }} />
      </form>
      {leases.isError ? <QueryFailure error={leases.error} label="La liste des baux" onRetry={leases.refetch} /> : null}
      {entries.isError ? (
        <QueryFailure error={entries.error} label="Les écritures" onRetry={entries.refetch} />
      ) : entries.isPending || entries.data === undefined ? (
        <LoadingPanel label="Les écritures" />
      ) : entries.data.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={filtered ? "Aucune écriture pour ces filtres" : "Aucune écriture"}
          description={filtered ? "Élargissez la période ou changez de journal." : "Les écritures apparaîtront ici dès que les modules de gestion en passeront."}
        >
          {filtered ? (
            <Button variant="secondary" onClick={reset}>
              Réinitialiser les filtres
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <>
          <EntryTable entries={entries.data} />
          {entries.moreError ? (
            <Alert tone="danger" title="La suite n’a pas pu être chargée">
              {entries.moreError.message}
            </Alert>
          ) : null}
          {entries.hasMore ? (
            <div>
              <Button variant="secondary" loading={entries.isFetchingMore} onClick={entries.fetchMore}>
                Afficher plus d’écritures
              </Button>
            </div>
          ) : null}
        </>
      )}
    </PageFrame>
  );
}
