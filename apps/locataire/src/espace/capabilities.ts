import { matchRoute, normalizedPath } from "./routeMatch";

export const GATED_FAMILIES = [
  "loyers",
  "prelevement",
  "simulation",
  "etatsDesLieux",
  "documents",
  "interventions",
  "assurance",
  "messages",
  "conge",
  "compte",
  "notifications",
  "autre",
] as const;
export type GatedFamily = (typeof GATED_FAMILIES)[number];

export const familyHasApiSource: Record<GatedFamily, boolean> = {
  loyers: false,
  prelevement: false,
  simulation: false,
  etatsDesLieux: false,
  documents: false,
  interventions: false,
  assurance: false,
  messages: false,
  conge: false,
  compte: false,
  notifications: false,
  autre: false,
};

export const familyLabel: Record<GatedFamily, string> = {
  loyers: "Paiement du loyer",
  prelevement: "Prélèvement automatique",
  simulation: "Page de paiement simulée",
  etatsDesLieux: "États des lieux",
  documents: "Documents",
  interventions: "Interventions",
  assurance: "Assurance",
  messages: "Messages",
  conge: "Donner congé",
  compte: "Mon compte",
  notifications: "Notifications",
  autre: "Cette page",
};

type Outcome = GatedFamily | "reelle";

const ROUTES: readonly (readonly [prefix: string, outcome: Outcome])[] = [
  ["/", "reelle"],
  ["/bail", "reelle"],
  ["/bail/conge", "conge"],
  ["/acces", "reelle"],
  ["/aide", "reelle"],
  ["/loyers", "loyers"],
  ["/loyers/prelevement", "prelevement"],
  ["/loyers/payer/simulation", "simulation"],
  ["/etats-des-lieux", "etatsDesLieux"],
  ["/documents", "documents"],
  ["/interventions", "interventions"],
  ["/assurance", "assurance"],
  ["/messages", "messages"],
  ["/compte", "compte"],
  ["/notifications", "notifications"],
];

const REAL_EXACT_ROUTES: readonly RegExp[] = [
  /^\/loyers$/,
  /^\/loyers\/echeances\/[^/]+$/,
  /^\/loyers\/quittances$/,
  /^\/loyers\/quittances\/[^/]+$/,
  /^\/loyers\/paiements$/,
  /^\/loyers\/paiements\/[^/]+$/,
  /^\/loyers\/regularisation$/,
  /^\/loyers\/regularisation\/[^/]+$/,
  /^\/loyers\/payer$/,
  /^\/paiement\/retour$/,
  /^\/documents$/,
  /^\/bail\/conge$/,
  /^\/assurance$/,
  /^\/assurance\/deposer$/,
  /^\/etats-des-lieux$/,
  /^\/etats-des-lieux\/[^/]+$/,
  /^\/interventions$/,
  /^\/interventions\/[^/]+$/,
  /^\/messages$/,
  /^\/messages\/[^/]+$/,
  /^\/annonces$/,
  /^\/annonces\/[^/]+$/,
  /^\/compte$/,
  /^\/compte\/securite$/,
  /^\/compte\/modifier$/,
  /^\/notifications$/,
  /^\/notifications\/toutes$/,
  /^\/support$/,
  /^\/support\/nouvelle$/,
  /^\/support\/[^/]+$/,
];

export function classifyRoute(pathname: string): Outcome | null {
  if (REAL_EXACT_ROUTES.some((route) => route.test(normalizedPath(pathname)))) return "reelle";
  return matchRoute(ROUTES, pathname);
}

export function unavailableFamilyOf(pathname: string): GatedFamily | null {
  const outcome = classifyRoute(pathname);
  if (outcome === "reelle") return null;
  const family = outcome ?? "autre";
  return familyHasApiSource[family] ? null : family;
}
