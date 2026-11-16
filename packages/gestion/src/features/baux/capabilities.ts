export const BAUX_FEATURES = ['balance', 'schedule', 'extras', 'exit', 'edl', 'reservations', 'import', 'attestations'] as const;
export type BauxFeature = (typeof BAUX_FEATURES)[number];

export const bauxFeatureLabel: Record<BauxFeature, string> = {
  balance: 'Soldes et dépôt de garantie reçu',
  schedule: 'Échéancier',
  extras: 'Documents, historique et actions du bail',
  exit: 'Suivi de sortie et restitution du dépôt',
  edl: 'États des lieux',
  reservations: 'Réservations',
  import: 'Import de baux en masse',
  attestations: 'Attestations de restitution',
};
