import { changelogSchema } from "./schemas";
import type { ChangelogEntry } from "./schemas";

export const CHANGELOG: ChangelogEntry[] = changelogSchema.parse([
  {
    id: "export-donnees",
    date: "2026-11-12",
    title: "Export de vos données",
    summary: "Demandez une archive de vos biens, locataires, baux et finances au format CSV ou JSON, depuis le menu du compte.",
    kind: "nouveau",
    href: "/compte/export",
  },
  {
    id: "rapports-complets",
    date: "2026-11-10",
    title: "Tous les rapports sont disponibles",
    summary: "Seize rapports de gestion : filtres, aperçu A4 imprimable, export CSV, envoi par e-mail et envois programmés.",
    kind: "nouveau",
    href: "/rapports",
  },
  {
    id: "compteur-messages",
    date: "2026-11-06",
    title: "Compteur de messages non lus",
    summary: "Le menu Messages affiche le nombre de conversations non lues et se met à jour dès que vous en ouvrez une.",
    kind: "amelioration",
    href: "/messages",
  },
  {
    id: "analytique",
    date: "2026-10-28",
    title: "Analytique : rentabilité et prévisionnel",
    summary: "Suivez le rendement par lot, l’occupation et vos prévisions de loyers sur les douze prochains mois.",
    kind: "nouveau",
    href: "/analytique",
  },
  {
    id: "menu-compte",
    date: "2026-10-20",
    title: "Menu du compte plus lisible",
    summary: "Les rubriques du compte sont regroupées et le changement d’espace est accessible en un clic.",
    kind: "amelioration",
  },
]);
