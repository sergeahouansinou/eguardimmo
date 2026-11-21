export const PROFILE_LABELS: Record<string, string> = {
  tenant: 'Locataire',
  owner: 'Propriétaire',
  organization: 'Organisation',
  operator: 'Opérateur',
};

export const LOOKUP_MODES = [
  { value: 'email', label: 'Adresse e-mail' },
  { value: 'id', label: 'Identifiant du compte' },
] as const;

export type LookupMode = (typeof LOOKUP_MODES)[number]['value'];
