import { matchRoute } from "@eguardimmo/gestion";

export const GATED_FAMILIES = [
  "accueil",
  "mandants",
  "mandats",
  "finances",
  "comptesRendus",
  "interventions",
  "devis",
  "conformite",
  "documents",
  "reglages",
  "compte",
  "roles",
  "invitationLocataire",
  "avisEcheance",
  "autre",
] as const;
export type GatedFamily = (typeof GATED_FAMILIES)[number];

export const familyHasApiSource: Record<GatedFamily, boolean> = {
  accueil: false,
  mandants: false,
  mandats: false,
  finances: false,
  comptesRendus: false,
  interventions: false,
  devis: false,
  conformite: false,
  documents: false,
  reglages: false,
  compte: false,
  roles: false,
  invitationLocataire: false,
  avisEcheance: false,
  autre: false,
};

export const familyLabel: Record<GatedFamily, string> = {
  accueil: "Accueil",
  mandants: "Mandants",
  mandats: "Mandats",
  finances: "Finances",
  comptesRendus: "Comptes rendus",
  interventions: "Interventions",
  devis: "Devis",
  conformite: "Conformité",
  documents: "Documents",
  reglages: "Réglages",
  compte: "Mon compte",
  roles: "Rôles et droits",
  invitationLocataire: "Invitation d’un locataire",
  avisEcheance: "Avis d’échéance",
  autre: "Cette page",
};

type Outcome = GatedFamily | "reelle";

const ROUTES: readonly (readonly [prefix: string, outcome: Outcome])[] = [
  ["/", "accueil"],
  ["/mandants", "mandants"],
  ["/mandats", "mandats"],
  ["/finances", "finances"],
  ["/comptes-rendus", "comptesRendus"],
  ["/interventions", "interventions"],
  ["/devis", "devis"],
  ["/conformite", "conformite"],
  ["/documents", "documents"],
  ["/reglages", "reglages"],
  ["/compte", "compte"],
  ["/equipe/roles", "roles"],
  ["/locataires/invitation", "invitationLocataire"],
  ["/baux/avis-echeance", "avisEcheance"],
  ["/biens", "reelle"],
  ["/locataires", "reelle"],
  ["/baux", "reelle"],
  ["/equipe", "reelle"],
  ["/messages", "reelle"],
  ["/campagnes", "reelle"],
  ["/aide", "reelle"],
  ["/notifications", "reelle"],
  ["/compte/securite", "reelle"],
];

export function classifyRoute(pathname: string): Outcome | null {
  return matchRoute(ROUTES, pathname);
}

export function unavailableFamilyOf(pathname: string): GatedFamily | null {
  const outcome = classifyRoute(pathname);
  if (outcome === "reelle") return null;
  const family = outcome ?? "autre";
  return familyHasApiSource[family] ? null : family;
}
