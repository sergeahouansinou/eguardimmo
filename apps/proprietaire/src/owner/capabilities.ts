import { matchRoute, normalizedPath } from "@eguardimmo/gestion";

export const GATED_FAMILIES = [
  "biens",
  "baux",
  "loyers",
  "charges",
  "factures",
  "comptesRendus",
  "fiscalite",
  "documents",
  "interventions",
  "devis",
  "apercu",
  "mandat",
  "compteDePaiement",
  "messages",
  "informations",
  "securite",
  "notifications",
  "aide",
  "autre",
] as const;
export type GatedFamily = (typeof GATED_FAMILIES)[number];

export const familyHasApiSource: Record<GatedFamily, boolean> = {
  biens: true,
  baux: true,
  loyers: true,
  charges: true,
  factures: true,
  comptesRendus: true,
  fiscalite: false,
  documents: true,
  interventions: true,
  devis: true,
  apercu: true,
  mandat: false,
  compteDePaiement: true,
  messages: false,
  informations: true,
  securite: true,
  notifications: true,
  aide: false,
  autre: false,
};

export const familyLabel: Record<GatedFamily, string> = {
  biens: "Mes biens",
  baux: "Baux",
  loyers: "Loyers et reversements",
  charges: "Décomptes de charges",
  factures: "Factures d’honoraires",
  comptesRendus: "Comptes rendus de gestion",
  fiscalite: "Fiscalité",
  documents: "Documents",
  interventions: "Interventions",
  devis: "Décision sur devis",
  apercu: "Aperçu du compte rendu",
  mandat: "Mon mandat",
  compteDePaiement: "Compte de paiement",
  messages: "Messages",
  informations: "Mes informations",
  securite: "Sécurité du compte",
  notifications: "Notifications",
  aide: "Aide",
  autre: "Cette page",
};

type Outcome = GatedFamily | "reelle";

const ROUTES: readonly (readonly [prefix: string, outcome: Outcome])[] = [
  ["/confie/biens", "biens"],
  ["/confie/baux", "baux"],
  ["/confie/factures", "factures"],
  ["/confie/loyers", "loyers"],
  ["/confie/charges", "charges"],
  ["/confie/comptes-rendus", "comptesRendus"],
  ["/confie/fiscalite", "fiscalite"],
  ["/confie/documents", "documents"],
  ["/confie/interventions", "interventions"],
  ["/confie/agence", "mandat"],
  ["/confie/compte-de-paiement", "compteDePaiement"],
  ["/confie/messages", "messages"],
  ["/confie/informations", "informations"],
  ["/confie/securite", "securite"],
  ["/confie/notifications", "notifications"],
  ["/confie/aide", "aide"],
];

const ROUTE_PATTERNS: readonly (readonly [pattern: RegExp, family: GatedFamily])[] = [
  [/^\/confie\/interventions\/[^/]+\/devis$/, "devis"],
  [/^\/confie\/comptes-rendus\/[^/]+\/apercu$/, "apercu"],
];

const REAL_EXACT_ROUTES: readonly RegExp[] = [
  /^\/confie$/,
  /^\/confie\/releve$/,
  /^\/confie\/fiscalite$/,
  /^\/confie\/fiscalite\/(?!declaration-2044$)[^/]+$/,
  /^\/confie\/agence$/,
  /^\/confie\/agence\/mandat$/,
  /^\/confie\/agence\/mandat\/fin$/,
  /^\/confie\/aide$/,
  /^\/confie\/messages$/,
  /^\/confie\/messages\/[^/]+$/,
  /^\/confie\/annonces$/,
  /^\/confie\/annonces\/[^/]+$/,
  /^\/confie\/support$/,
  /^\/confie\/support\/nouvelle$/,
  /^\/confie\/support\/[^/]+$/,
];

export function classifyRoute(pathname: string): Outcome | null {
  const specific = ROUTE_PATTERNS.find(([pattern]) => pattern.test(normalizedPath(pathname)));
  if (specific) return specific[1];
  if (REAL_EXACT_ROUTES.some((route) => route.test(normalizedPath(pathname)))) return "reelle";
  return matchRoute(ROUTES, pathname);
}

export function unavailableFamilyOf(pathname: string): GatedFamily | null {
  const outcome = classifyRoute(pathname);
  if (outcome === "reelle") return null;
  const family = outcome ?? "autre";
  return familyHasApiSource[family] ? null : family;
}
