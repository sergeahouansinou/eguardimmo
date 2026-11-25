import { matchRoute, normalizedPath } from "@eguardimmo/gestion";

export const GATED_FAMILIES = [
  "accueil",
  "mandants",
  "mandats",
  "finances",
  "comptesRendus",
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
  accueil: true,
  mandants: true,
  mandats: true,
  finances: false,
  comptesRendus: true,
  devis: false,
  conformite: false,
  documents: false,
  reglages: false,
  compte: false,
  roles: false,
  invitationLocataire: true,
  avisEcheance: true,
  autre: false,
};

export const familyLabel: Record<GatedFamily, string> = {
  accueil: "Accueil",
  mandants: "Mandants",
  mandats: "Mandats",
  finances: "Finances",
  comptesRendus: "Comptes rendus",
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
  ["/finances/loyers", "reelle"],
  ["/finances/recouvrement", "reelle"],
  ["/finances/factures", "reelle"],
  ["/finances/reversements", "reelle"],
  ["/finances/honoraires", "reelle"],
  ["/finances/honoraires/bareme", "finances"],
  ["/finances/comptabilite", "reelle"],
  ["/finances/fonds", "reelle"],
  ["/finances/cloture", "reelle"],
  ["/finances/depenses", "reelle"],
  ["/finances/charges", "reelle"],
  ["/finances/banque", "reelle"],
  ["/finances/paiements-en-ligne", "reelle"],
  ["/annonces", "reelle"],
  ["/comptes-rendus", "comptesRendus"],
  ["/interventions", "reelle"],
  ["/devis", "devis"],
  ["/conformite", "reelle"],
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
  ["/compte/notifications", "reelle"],
  ["/agenda", "reelle"],
  ["/taches", "reelle"],
  ["/contacts", "reelle"],
  ["/journal", "reelle"],
];

const REAL_EXACT_ROUTES: readonly string[] = [
  "/compte",
  "/finances/impayes",
  "/finances/encaissements",
  "/finances/encaissements/nouveau",
  "/finances/honoraires/bareme",
  "/devis",
  "/documents",
  "/documents/ajout",
  "/reglages",
  "/reglages/acces-support",
  "/reglages/fuseau-horaire",
  "/reglages/finances",
  "/reglages/champs",
  "/reglages/demandes-rgpd",
  "/finances/fiscalite",
  "/analytique",
  "/analytique/revenus-depenses",
  "/analytique/occupation",
  "/equipe/roles",
  "/support",
  "/support/nouvelle",
];

const REAL_PATTERNS: readonly RegExp[] = [/^\/finances\/impayes\/[^/]+$/, /^\/finances\/fiscalite\/[^/]+$/, /^\/support\/[^/]+$/];

export function classifyRoute(pathname: string): Outcome | null {
  const path = normalizedPath(pathname);
  if (REAL_EXACT_ROUTES.includes(path) || REAL_PATTERNS.some((pattern) => pattern.test(path))) return "reelle";
  return matchRoute(ROUTES, pathname);
}

export function unavailableFamilyOf(pathname: string): GatedFamily | null {
  const outcome = classifyRoute(pathname);
  if (outcome === "reelle") return null;
  const family = outcome ?? "autre";
  return familyHasApiSource[family] ? null : family;
}
