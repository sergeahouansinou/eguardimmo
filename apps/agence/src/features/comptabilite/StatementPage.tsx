"use client";

import { Alert, Button, Select, TextField } from "@eguardimmo/ui";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { SubmitEvent } from "react";
import { PageFrame } from "@/features/kit";
import { LoadingPanel, QueryFailure } from "@/features/org/QueryBoundary";
import { todayIso } from "@/features/org/today";
import { useLeaseOptions, useStatement } from "./hooks";
import { comptabilitePaths } from "./paths";
import type { StatementInput } from "./schemas";
import { StatementResult } from "./StatementResult";
import { currencyChoices, defaultPeriod, validateStatement } from "./statementForm";
import type { StatementFormErrors } from "./statementForm";

export function StatementPage() {
  const requestedLease = useSearchParams().get("bail") ?? "";
  const leases = useLeaseOptions();
  const [period] = useState(() => defaultPeriod(todayIso()));
  const [lease, setLease] = useState(requestedLease);
  const [currency, setCurrency] = useState("");
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  const [errors, setErrors] = useState<StatementFormErrors>({});
  const [submitted, setSubmitted] = useState<StatementInput | null>(null);

  const chosen = leases.data?.find((option) => option.id === lease);
  const effectiveCurrency = currency === "" ? (chosen?.currency ?? "EUR") : currency;
  const automatic = submitted === null && requestedLease !== "" && chosen !== undefined ? { lease: chosen.id, currency: chosen.currency, from: period.from, to: period.to } : null;
  const statement = useStatement(submitted ?? automatic);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateStatement({ lease, currency: effectiveCurrency, from, to });
    if ("errors" in result) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitted(result.input);
  };

  return (
    <PageFrame
      crumbs={[{ label: "Finances" }, { label: "Comptabilité", href: comptabilitePaths.accounts }, { label: "Relevé de bail" }]}
      title="Relevé de bail"
      description="Compte locataire d’un bail entre deux dates : appels, règlements et solde cumulé."
    >
      {leases.isError ? <QueryFailure error={leases.error} label="La liste des baux" onRetry={leases.refetch} /> : null}
      <form onSubmit={submit} noValidate aria-label="Critères du relevé" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <Select
          label="Bail"
          placeholder={leases.data === undefined ? "Chargement des baux" : "Choisir un bail"}
          options={(leases.data ?? []).map((option) => ({ value: option.id, label: option.label }))}
          value={lease}
          onValueChange={(value) => {
            setLease(value);
            setCurrency("");
          }}
          searchable
          searchPlaceholder="Rechercher un bail"
          disabled={leases.data === undefined}
          error={errors.lease}
        />
        <Select label="Devise" placeholder="Devise" options={currencyChoices(chosen).map((code) => ({ value: code, label: code }))} value={effectiveCurrency} onValueChange={setCurrency} error={errors.currency} />
        <TextField label="Du" placeholder="AAAA-MM-JJ" type="date" value={from} error={errors.from} onChange={(event) => { setFrom(event.target.value); }} />
        <TextField label="Au" placeholder="AAAA-MM-JJ" type="date" value={to} error={errors.to} onChange={(event) => { setTo(event.target.value); }} />
        <Button type="submit" variant="primary" loading={statement.isFetching && statement.data === undefined}>
          Afficher le relevé
        </Button>
      </form>
      {submitted === null && automatic === null ? (
        <Alert tone="info">Choisissez un bail et une période pour afficher le relevé.</Alert>
      ) : statement.isError ? (
        <QueryFailure error={statement.error} label="Le relevé" onRetry={statement.refetch} />
      ) : statement.data === undefined ? (
        <LoadingPanel label="Le relevé" />
      ) : (
        <StatementResult statement={statement.data} />
      )}
    </PageFrame>
  );
}
