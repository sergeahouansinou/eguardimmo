import { matchRoute, normalizedPath } from './routeMatch';

export const GATED_FAMILIES = [
  'bureau',
  'finances',
  'analytique',
  'rapports',
  'agenda',
  'taches',
  'interventions',
  'contacts',
  'journal',
  'documents',
  'compte',
  'reglages',
  'autre',
] as const;
export type GatedFamily = (typeof GATED_FAMILIES)[number];

export const familyHasApiSource: Record<GatedFamily, boolean> = {
  bureau: true,
  finances: false,
  analytique: false,
  rapports: false,
  agenda: true,
  taches: true,
  interventions: false,
  contacts: true,
  journal: true,
  documents: false,
  compte: false,
  reglages: false,
  autre: false,
};

export const familyLabel: Record<GatedFamily, string> = {
  bureau: 'Accueil',
  finances: 'Finances',
  analytique: 'Analytique',
  rapports: 'Rapports',
  agenda: 'Agenda',
  taches: 'Tâches et rappels',
  interventions: 'Interventions',
  contacts: 'Contacts',
  journal: 'Journal d’activité',
  documents: 'Documents',
  compte: 'Mon compte',
  reglages: 'Réglages',
  autre: 'Cette page',
};

type Outcome = GatedFamily | 'reelle';

const ROUTES: readonly (readonly [prefix: string, outcome: Outcome])[] = [
  ['/', 'bureau'],
  ['/finances', 'finances'],
  ['/finances/loyers', 'reelle'],
  ['/finances/recouvrement', 'reelle'],
  ['/finances/depenses', 'reelle'],
  ['/finances/charges', 'reelle'],
  ['/finances/banque', 'reelle'],
  ['/analytique', 'analytique'],
  ['/rapports', 'rapports'],
  ['/agenda', 'agenda'],
  ['/taches', 'taches'],
  ['/interventions', 'interventions'],
  ['/contacts', 'contacts'],
  ['/journal', 'journal'],
  ['/documents', 'documents'],
  ['/compte', 'compte'],
  ['/reglages', 'reglages'],
  ['/messages', 'reelle'],
  ['/campagnes', 'reelle'],
  ['/aide', 'reelle'],
  ['/notifications', 'reelle'],
  ['/equipe', 'reelle'],
  ['/locataires', 'reelle'],
  ['/baux', 'reelle'],
  ['/biens', 'reelle'],
  ['/compte/securite', 'reelle'],
  ['/reglages/notifications', 'reelle'],
  ['/modeles', 'reelle'],
  ['/documents/quittances', 'reelle'],
  ['/documents/avis-echeance', 'reelle'],
  ['/documents/courriers', 'reelle'],
  ['/documents/signatures', 'reelle'],
  ['/documents/attestations', 'reelle'],
  ['/conformite', 'reelle'],
];

const REAL_EXACT_ROUTES: readonly string[] = ['/compte', '/finances/impayes', '/finances/encaissements/nouveau', '/finances/regularisation', '/finances/import-bancaire', '/interventions', '/interventions/prestataires', '/documents', '/analytique', '/analytique/revenus-depenses', '/analytique/occupation', '/analytique/rentabilite', '/analytique/previsionnel', '/finances/prets', '/finances/cout-de-revient', '/finances/fiscalite', '/reglages/acces-support', '/reglages/fuseau-horaire', '/support', '/support/nouvelle'];

const REAL_PATTERNS: readonly RegExp[] = [/^\/finances\/impayes\/[^/]+$/, /^\/finances\/prets\/[^/]+$/, /^\/finances\/fiscalite\/[^/]+$/, /^\/interventions\/[^/]+$/, /^\/support\/[^/]+$/];

export function classifyRoute(pathname: string): Outcome | null {
  const path = normalizedPath(pathname);
  if (REAL_EXACT_ROUTES.includes(path) || REAL_PATTERNS.some((pattern) => pattern.test(path))) return 'reelle';
  return matchRoute(ROUTES, pathname);
}

export function unavailableFamilyOf(pathname: string): GatedFamily | null {
  const outcome = classifyRoute(pathname);
  if (outcome === 'reelle') return null;
  const family = outcome ?? 'autre';
  return familyHasApiSource[family] ? null : family;
}
