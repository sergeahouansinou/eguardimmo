"use client";

import { Select } from "@eguardimmo/ui";
import { ROLE_LABELS, agencyLabel } from "../format";
import type { OwnerAccess } from "../model";

export function accessLabel(access: OwnerAccess): string {
  return `${access.mandantName} · ${agencyLabel(access.agencyName)}`;
}

export function AccessSelector({ accesses, selected, onSelect }: { accesses: readonly OwnerAccess[]; selected: OwnerAccess; onSelect: (accessId: string) => void }) {
  return (
    <Select
      label="Agence et mandant"
      placeholder="Choisissez une agence"
      value={selected.accessId}
      onValueChange={onSelect}
      options={accesses.map((access) => ({ value: access.accessId, label: accessLabel(access), description: ROLE_LABELS[access.role] }))}
      hint="Chaque agence est présentée séparément : aucun total n’additionne deux agences."
    />
  );
}
