export const BIEN_IDS = ['les-tilleuls', 'apt-a1', 'apt-b3', 'villa-rdc', 'residence-du-parc'] as const;
export type BienId = (typeof BIEN_IDS)[number];

interface BienRef {
  id: BienId;
  label: string;
  short: string;
  parentId?: BienId;
}

export const BIENS: readonly BienRef[] = [
  { id: 'les-tilleuls', label: 'Les Tilleuls', short: 'Les Tilleuls' },
  { id: 'apt-a1', label: 'Apt A1, Les Tilleuls', short: 'Apt A1', parentId: 'les-tilleuls' },
  { id: 'apt-b3', label: 'Apt B3, Les Tilleuls', short: 'Apt B3', parentId: 'les-tilleuls' },
  { id: 'villa-rdc', label: 'Villa RDC, Maison Rivière', short: 'Villa RDC' },
  { id: 'residence-du-parc', label: 'Résidence du Parc', short: 'Résidence du Parc' },
];

export const bienLabel = (id: BienId): string => BIENS.find((bien) => bien.id === id)?.label ?? id;

export const bienShort = (id: BienId): string => BIENS.find((bien) => bien.id === id)?.short ?? id;

export const bienOptions = (kind: 'label' | 'short' = 'label') =>
  BIENS.map((bien) => ({ value: bien.id, label: bien[kind] }));

export const ALL = 'tous';

export function matchesBien(itemBien: BienId | null | undefined, filter: string): boolean {
  if (filter === ALL || filter === '') return true;
  if (!itemBien) return false;
  if (itemBien === filter) return true;
  return BIENS.find((bien) => bien.id === itemBien)?.parentId === filter;
}

export const ASSIGNEES = ['Marie Chabi', 'Paul Agossou'] as const;
export type Assignee = (typeof ASSIGNEES)[number];

export const INTERVENANTS = ['Plomberie Sanvi', 'Peinture Dupont', 'Chauffage Mensah'] as const;

export const TENANT_BY_BIEN: Partial<Record<BienId, string>> = {
  'apt-a1': 'Koffi Adjovi',
  'villa-rdc': 'Marc Dossou',
};

export const tenantOf = (bienId: string): string | null =>
  Object.entries(TENANT_BY_BIEN).find(([key]) => key === bienId)?.[1] ?? null;
