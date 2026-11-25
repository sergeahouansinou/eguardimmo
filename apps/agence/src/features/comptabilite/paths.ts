export const comptabilitePaths = {
  accounts: "/finances/comptabilite",
  entries: "/finances/comptabilite/ecritures",
  statement: "/finances/comptabilite/releve",
} as const;

export function entryHref(id: string): string {
  return `${comptabilitePaths.entries}/${encodeURIComponent(id)}`;
}

export function statementHref(leaseId: string): string {
  return `${comptabilitePaths.statement}?bail=${encodeURIComponent(leaseId)}`;
}
