import { matchRoute } from './routeMatch';

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
  bureau: false,
  finances: false,
  analytique: false,
  rapports: false,
  agenda: false,
  taches: false,
  interventions: false,
  contacts: false,
  journal: false,
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
  ['/modeles', 'reelle'],
  ['/documents/quittances', 'reelle'],
  ['/documents/avis-echeance', 'reelle'],
  ['/documents/courriers', 'reelle'],
  ['/documents/signatures', 'reelle'],
  ['/documents/attestations', 'reelle'],
];

export function classifyRoute(pathname: string): Outcome | null {
  return matchRoute(ROUTES, pathname);
}

export function unavailableFamilyOf(pathname: string): GatedFamily | null {
  const outcome = classifyRoute(pathname);
  if (outcome === 'reelle') return null;
  const family = outcome ?? 'autre';
  return familyHasApiSource[family] ? null : family;
}
