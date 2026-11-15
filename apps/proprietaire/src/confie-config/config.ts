import {
  ArrowLeftRight,
  Building,
  CircleQuestionMark,
  CircleUser,
  FileChartColumn,
  Folder,
  Handshake,
  House,
  Landmark,
  MessageSquare,
  Bell,
  ShieldCheck,
  Wallet,
  Wrench,
} from "lucide-react";
import { authUrl } from "@eguardimmo/shell";
import type {
  AccountMenuConfig,
  BottomItem,
  NotificationsConfig,
  PageResult,
  ShellCounts,
  ShellNavigation,
} from "@eguardimmo/shell";
import { confieRoutes } from "@/features/confie/routes";
import { toShellHref } from "./paths";

export const SPACE_LABEL = "Espace propriétaire";
export const RAIL_STORAGE_KEY = "eg-nav-confie";
export const SEARCH_PLACEHOLDER = "Rechercher une page, ex. : Reversements";
export const SEARCH_NOTE = "La recherche porte sur les pages. Vos lots et documents s'y ajouteront avec leurs écrans.";

const href = toShellHref;

export function buildNavigation(counts: ShellCounts | undefined): ShellNavigation {
  return {
    sections: [
      {
        id: "patrimoine",
        label: "Mon patrimoine",
        entries: [
          { id: "accueil", label: "Accueil", href: href(confieRoutes.home), icon: House },
          { id: "biens", label: "Mes biens", href: href(confieRoutes.biens), icon: Building, count: counts?.biens },
          { id: "loyers", label: "Loyers et reversements", href: href(confieRoutes.loyers), icon: Wallet },
          { id: "comptes-rendus", label: "Comptes rendus", href: href(confieRoutes.comptesRendus), icon: FileChartColumn, count: counts?.["comptes-rendus"] },
          { id: "fiscalite", label: "Fiscalité", href: href(confieRoutes.fiscalite), icon: Landmark },
          { id: "documents", label: "Documents", href: href(confieRoutes.documents), icon: Folder },
        ],
      },
      {
        id: "echanges",
        label: "Échanges",
        entries: [
          { id: "messages", label: "Messages", href: href(confieRoutes.messages), icon: MessageSquare, count: counts?.messages },
          { id: "interventions", label: "Interventions", href: href(confieRoutes.interventions), icon: Wrench, count: counts?.interventions },
          { id: "agence", label: "Mon agence", href: href(confieRoutes.agence), icon: Handshake },
        ],
      },
    ],
    footer: [
      { id: "informations", label: "Mes informations", href: href(confieRoutes.informations), icon: CircleUser },
      { id: "aide", label: "Aide", href: href(confieRoutes.aide), icon: CircleQuestionMark },
      { id: "gestion-directe", label: "Mes biens en gestion directe", href: href(confieRoutes.gestionDirecte), icon: ArrowLeftRight },
    ],
  };
}

export const bottomItems: BottomItem[] = [
  { id: "accueil", label: "Accueil", icon: House, href: href(confieRoutes.home) },
  { id: "biens", label: "Biens", icon: Building, href: href(confieRoutes.biens) },
  { id: "loyers", label: "Loyers", icon: Wallet, href: href(confieRoutes.loyers) },
  { id: "interventions", label: "Travaux", icon: Wrench, href: href(confieRoutes.interventions) },
];

export const accountMenu: AccountMenuConfig = {
  roleLabels: { mandant: "Propriétaire mandant" },
  switchSpace: { href: authUrl("/profils") },
  signOut: { href: authUrl("/deconnecte") },
  groups: [
    {
      id: "compte",
      label: "Mon compte",
      items: [
        { id: "informations", label: "Mes informations", href: href(confieRoutes.informations), icon: CircleUser },
        { id: "securite", label: "Sécurité", href: href(confieRoutes.securite), icon: ShieldCheck },
        { id: "notifications", label: "Notifications", href: href(confieRoutes.notifications), icon: Bell },
      ],
    },
    {
      id: "espaces",
      label: "Autre espace",
      items: [
        { id: "gestion-directe", label: "Mes biens en gestion directe", href: href(confieRoutes.gestionDirecte), icon: ArrowLeftRight },
      ],
    },
  ],
  footerItems: [{ id: "aide", label: "Centre d'aide", href: href(confieRoutes.aide), icon: CircleQuestionMark }],
};

export const notifications: NotificationsConfig = {
  allHref: href(confieRoutes.notificationsToutes),
  settingsHref: href(confieRoutes.notifications),
};

export const searchPages: PageResult[] = [
  { href: href(confieRoutes.home), label: "Accueil" },
  { href: href(confieRoutes.biens), label: "Mes biens" },
  { href: href(confieRoutes.loyers), label: "Loyers et reversements" },
  { href: href(confieRoutes.comptesRendus), label: "Comptes rendus de gestion" },
  { href: href(confieRoutes.fiscalite), label: "Fiscalité, revenus fonciers" },
  { href: href(confieRoutes.declaration), label: "Aide à la déclaration 2044" },
  { href: href(confieRoutes.documents), label: "Documents" },
  { href: href(confieRoutes.interventions), label: "Interventions" },
  { href: href(confieRoutes.agence), label: "Mon agence" },
  { href: href(confieRoutes.mandat), label: "Mon mandat" },
  { href: href(confieRoutes.informations), label: "Mes informations" },
  { href: href(confieRoutes.securite), label: "Sécurité du compte" },
  { href: href(confieRoutes.notifications), label: "Notifications, préférences" },
  { href: href(confieRoutes.notificationsToutes), label: "Toutes les notifications" },
  { href: href(confieRoutes.messages), label: "Messages" },
  { href: href(confieRoutes.aide), label: "Aide" },
  { href: href(confieRoutes.gestionDirecte), label: "Mes biens en gestion directe" },
];
