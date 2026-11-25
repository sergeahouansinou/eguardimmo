import { matchRoute } from "./routeMatch";

export const GATED_FAMILIES = [
  "accueil",
  "organisations",
  "organisations-creation",
  "organisations-modules",
  "comptes",
  "modules",
  "abonnements",
  "abonnements-creation",
  "marketing",
  "rappels",
  "audit",
  "rgpd",
  "support",
  "approbations",
  "sante",
  "sante-incidents",
  "sauvegardes",
  "sauvegardes-restauration",
  "parametres",
  "notifications",
  "equipe",
  "equipe-invitation",
  "aide",
  "autre",
] as const;
export type GatedFamily = (typeof GATED_FAMILIES)[number];

export const familyHasApiSource: Record<GatedFamily, boolean> = {
  accueil: true,
  organisations: true,
  "organisations-creation": false,
  "organisations-modules": true,
  comptes: true,
  modules: true,
  abonnements: true,
  "abonnements-creation": false,
  marketing: true,
  rappels: true,
  audit: true,
  rgpd: true,
  support: true,
  approbations: true,
  sante: true,
  "sante-incidents": false,
  sauvegardes: true,
  "sauvegardes-restauration": false,
  parametres: true,
  notifications: false,
  equipe: true,
  "equipe-invitation": false,
  aide: true,
  autre: false,
};

export const familyLabel: Record<GatedFamily, string> = {
  accueil: "Vue d’ensemble",
  organisations: "Organisations",
  "organisations-creation": "Création d’organisation",
  "organisations-modules": "Modules d’une organisation",
  comptes: "Comptes et profils",
  modules: "Modules",
  abonnements: "Abonnements",
  "abonnements-creation": "Nouveau plan",
  marketing: "Marketing",
  rappels: "Notifications et rappels",
  audit: "Journal d’audit",
  rgpd: "Conformité RGPD",
  support: "Support",
  approbations: "Approbations",
  sante: "Santé du système",
  "sante-incidents": "Incidents",
  sauvegardes: "Sauvegardes",
  "sauvegardes-restauration": "Restauration",
  parametres: "Paramètres",
  notifications: "Notifications",
  equipe: "Équipe opérateur",
  "equipe-invitation": "Invitation d’un opérateur",
  aide: "Centre d’aide",
  autre: "Cette page",
};

/** Précision affichée sous « Bientôt disponible » quand la décision écarte durablement la fonction (ADR 0037). */
export const familyNote: Partial<Record<GatedFamily, string>> = {
  "organisations-creation": "La création d’une organisation se fait en libre-service ; la console ne l’écrit pas au nom d’un client.",
  "abonnements-creation": "Un plan évolue par versions : ouvrez un brouillon depuis le plan concerné.",
  "sante-incidents": "Les incidents et la page de statut sont tenus hors de l’application, qui ne peut pas annoncer sa propre panne.",
  "sauvegardes-restauration": "Une restauration ne se demande jamais depuis l’application : elle suit la procédure d’hébergement.",
  notifications: "Les opérateurs ne reçoivent pas de notifications dans la console ; les alertes passent par la boîte d’équipe.",
  "equipe-invitation": "Les opérateurs et leurs rôles s’attribuent par commande sur le serveur, jamais depuis la console.",
};

const ROUTES: readonly (readonly [prefix: string, family: GatedFamily])[] = [
  ["/", "accueil"],
  ["/organisations", "organisations"],
  ["/organisations/nouvelle", "organisations-creation"],
  ["/organisations/*/modules", "organisations-modules"],
  ["/comptes", "comptes"],
  ["/modules", "modules"],
  ["/abonnements", "abonnements"],
  ["/abonnements/plans/nouveau", "abonnements-creation"],
  ["/marketing", "marketing"],
  ["/rappels", "rappels"],
  ["/audit", "audit"],
  ["/rgpd", "rgpd"],
  ["/support", "support"],
  ["/approbations", "approbations"],
  ["/sante", "sante"],
  ["/sante/incidents", "sante-incidents"],
  ["/sauvegardes", "sauvegardes"],
  ["/sauvegardes/restauration", "sauvegardes-restauration"],
  ["/parametres", "parametres"],
  ["/parametres/notifications", "notifications"],
  ["/notifications", "notifications"],
  ["/equipe", "equipe"],
  ["/equipe/inviter", "equipe-invitation"],
  ["/aide", "aide"],
];

export function classifyRoute(pathname: string): GatedFamily | null {
  return matchRoute(ROUTES, pathname);
}

export function unavailableFamilyOf(pathname: string): GatedFamily | null {
  const family = classifyRoute(pathname) ?? "autre";
  return familyHasApiSource[family] ? null : family;
}
