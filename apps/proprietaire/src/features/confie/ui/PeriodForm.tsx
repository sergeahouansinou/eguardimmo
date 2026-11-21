"use client";

import { Button, DateRangeField, Icon } from "@eguardimmo/ui";
import { Search } from "lucide-react";
import { useState } from "react";
import { MAX_PERIOD_DAYS, parsePeriod } from "../data/period";
import type { Period } from "../data/period";

export interface PeriodFormProps {
  initial: Period;
  legend: string;
  onApply: (period: Period) => void;
  busy?: boolean;
}

export function PeriodForm({ initial, legend, onApply, busy = false }: PeriodFormProps) {
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [error, setError] = useState<string>();
  return (
    <form
      noValidate
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const result = parsePeriod(from, to);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setError(undefined);
        onApply(result.period);
      }}
    >
      <DateRangeField
        className="w-full sm:w-auto sm:min-w-96"
        legend={legend}
        from={from}
        to={to}
        onFromChange={(value) => {
          setFrom(value);
          setError(undefined);
        }}
        onToChange={(value) => {
          setTo(value);
          setError(undefined);
        }}
        hint={`Par défaut le mois en cours, ${String(MAX_PERIOD_DAYS)} jours au plus. La date de fin est incluse.`}
        error={error}
      />
      <Button type="submit" variant="secondary" loading={busy}>
        <Icon icon={Search} />
        Afficher le relevé
      </Button>
    </form>
  );
}
