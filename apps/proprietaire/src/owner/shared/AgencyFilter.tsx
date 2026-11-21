"use client";

import { Alert, Button, Select } from "@eguardimmo/ui";
import { agencyLabel } from "../format";
import type { AgencyFilter as Filter } from "./useAgencyFilter";

const ALL = "all";

export function AgencyFilter({ filter }: { filter: Filter }) {
  const { agencies, agency, unknown, setAgency } = filter;
  if (unknown) {
    return (
      <Alert tone="warning" title="Agence introuvable">
        <span className="flex flex-wrap items-center gap-2">
          Cette agence n’est plus accessible depuis votre espace.
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              setAgency(null);
            }}
          >
            Voir toutes mes agences
          </Button>
        </span>
      </Alert>
    );
  }
  if (agencies.length < 2) return null;
  return (
    <Select
      label="Agence"
      placeholder="Choisissez une agence"
      value={agency ?? ALL}
      onValueChange={(value) => {
        setAgency(value === ALL ? null : value);
      }}
      options={[{ value: ALL, label: "Toutes mes agences" }, ...agencies.map((entry) => ({ value: entry.id, label: agencyLabel(entry.name) }))]}
      hint="Chaque agence est présentée séparément : aucun total n’additionne deux agences."
    />
  );
}
