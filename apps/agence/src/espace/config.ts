import {
  Banknote,
  BadgeCheck,
  Building2,
  CircleAlert,
  CircleQuestionMark,
  CircleUser,
  Contact,
  CreditCard,
  FilePenLine,
  Folder,
  Handshake,
  House,
  KeyRound,
  Megaphone,
  MessageSquare,
  Percent,
  ScrollText,
  Settings,
  Users,
  UsersRound,
  Wallet,
  Wrench,
  Bell,
} from "lucide-react";
import type { ShellCounts } from "@eguardimmo/shell";
import type {
  AccountMenuConfig,
  AddMenuGroup,
  BottomItem,
  HelpMenuItem,
  NotificationsConfig,
  PageResult,
  ShellNavigation,
} from "@eguardimmo/shell";
import { demoBiens, demoMandants } from "@/features/portefeuille/demoCore";
import { demoLocataires } from "@/features/portefeuille/demoBaux";
import { agenceRoutes as r, bienHref, locataireHref, mandantHref } from "./routes";

export const SPACE_LABEL = "Espace agence sous mandat";
export const RAIL_STORAGE_KEY = "eg-nav-agence";
export const SEARCH_PLACEHOLDER = "Rechercher, ex. : Marc Chevalier, Apt 12, Impayés";
export const SEARCH_NOTE = "La recherche porte sur les pages, les mandants, les lots et les locataires.";

export function buildNavigation(counts?: ShellCounts): ShellNavigation {
  return {
    sections: [
      {
        id: "gestion",
        label: "Gestion",
        entries: [
          { id: "accueil", label: "Accueil", href: r.home, icon: House },
          { id: "mandants", label: "Mandants", href: r.mandants, icon: Contact },
          { id: "mandats", label: "Mandats", href: r.mandats, icon: Handshake, count: counts?.mandats },
          { id: "biens", label: "Biens sous mandat", href: r.biens, icon: Building2, count: counts?.biens },
          { id: "locataires", label: "Locataires", href: r.locataires, icon: Users },
          { id: "baux", label: "Baux", href: r.baux, icon: FilePenLine },
        ],
      },
      {
        id: "finances",
        label: "Finances",
        entries: [
          { id: "encaissements", label: "Encaissements", href: r.encaissements, icon: Banknote },
          { id: "impayes", label: "Impayés", href: r.impayes, icon: CircleAlert, count: counts?.impayes },
          { id: "reversements", label: "Reversements", href: r.reversements, icon: Wallet, count: counts?.reversements },
          { id: "honoraires", label: "Honoraires", href: r.honoraires, icon: Percent },
          { id: "comptes-rendus", label: "Comptes rendus", href: r.comptesRendus, icon: ScrollText, count: counts?.comptesRendus },
        ],
      },
      {
        id: "suivi",
        label: "Suivi",
        entries: [
          { id: "messages", label: "Messages", href: r.messages, icon: MessageSquare, count: counts?.messages },
          { id: "campagnes", label: "Campagnes", href: r.campagnes, icon: Megaphone },
          { id: "interventions", label: "Interventions", href: r.interventions, icon: Wrench, count: counts?.interventions },
          { id: "conformite", label: "Conformité", href: r.conformite, icon: BadgeCheck },
          { id: "documents", label: "Documents", href: r.documents, icon: Folder },
        ],
      },
    ],
    footer: [
      { id: "reglages", label: "Réglages", href: r.reglages, icon: Settings },
      { id: "equipe", label: "Équipe", href: r.equipe, icon: UsersRound },
    ],
  };
}

export const bottomItems: BottomItem[] = [
  { id: "accueil", label: "Accueil", icon: House, href: r.home },
  { id: "mandats", label: "Mandats", icon: Handshake, href: r.mandats },
  { id: "biens", label: "Biens", icon: Building2, href: r.biens },
  { id: "impayes", label: "Impayés", icon: CircleAlert, href: r.impayes },
];

export const accountMenu: AccountMenuConfig = {
  roleLabels: { admin: "Administrateur", gestionnaire: "Gestionnaire", comptable: "Comptable" },
  switchSpace: { href: r.profiles },
  signOut: { href: r.signOut },
  groups: [
    {
      id: "compte",
      label: "Mon compte",
      items: [
        { id: "mon-compte", label: "Mon compte", href: r.compte, icon: CircleUser },
        { id: "securite", label: "Connexion et sécurité", href: r.compteSecurite, icon: KeyRound },
        { id: "notifications", label: "Notifications", href: r.compteNotifications, icon: Bell },
        { id: "abonnement", label: "Abonnement", href: r.compteAbonnement, icon: CreditCard, meta: (shell) => shell.workspace.plan },
      ],
    },
    {
      id: "espace",
      label: "Espace",
      items: [
        { id: "reglages", label: "Réglages", href: r.reglages, icon: Settings },
        {
          id: "equipe",
          label: "Équipe",
          href: r.equipe,
          icon: UsersRound,
          meta: ({ workspace }) => (workspace.members === undefined ? undefined : `${String(workspace.members)} membres`),
        },
      ],
    },
  ],
  footerItems: [{ id: "aide", label: "Centre d'aide", href: r.aide, icon: CircleQuestionMark }],
};

export const notifications: NotificationsConfig = { allHref: r.notifications, settingsHref: r.compteNotifications };

export const addMenu: AddMenuGroup[] = [
  {
    label: "Gestion",
    items: [
      { id: "nouveau-mandant", label: "Nouveau mandant", href: r.mandantNew },
      { id: "nouveau-mandat", label: "Nouveau mandat", href: r.mandatNew },
      { id: "nouveau-bail", label: "Nouveau bail", href: r.bailNew },
    ],
  },
  {
    label: "Finances",
    items: [
      { id: "nouvel-encaissement", label: "Nouvel encaissement", href: r.encaissementNew },
      { id: "nouveau-compte-rendu", label: "Nouveau compte rendu", href: r.comptesRendusNew },
    ],
  },
  {
    label: "Suivi",
    items: [
      { id: "nouvelle-intervention", label: "Nouvelle intervention", href: r.interventionNew },
      { id: "nouveau-message", label: "Nouveau message", href: r.messageNew },
      { id: "nouvelle-campagne", label: "Nouvelle campagne", href: r.campagneNew },
      { id: "ajout-document", label: "Ajouter un document", href: r.documentAdd },
    ],
  },
];

export const helpMenu: HelpMenuItem[] = [{ id: "centre-aide", label: "Centre d'aide", href: r.aide }];

export const plannedScreens: ReadonlyMap<string, string> = new Map([
  ["/biens/nouveau", "Nouveau bien"],
  ["/locataires/invitation", "Inviter un locataire"],
  ["/mandats/avenant", "Nouvel avenant"],
  ["/baux/avis-echeance", "Avis d'échéance"],
  [r.profiles, "Choix du profil"],
  [r.notifications, "Notifications"],
  [r.signOut, "Déconnexion"],
]);

export const deliveredPages: readonly (readonly [href: string, label: string])[] = [
  [r.home, "Accueil"],
  [r.mandants, "Mandants"],
  [r.mandantNew, "Nouveau mandant"],
  [r.mandats, "Mandats"],
  [r.mandatNew, "Nouveau mandat"],
  [r.biens, "Biens sous mandat"],
  [r.locataires, "Locataires"],
  [r.baux, "Baux"],
  [r.bailNew, "Nouveau bail"],
  [r.encaissements, "Encaissements"],
  [r.encaissementNew, "Nouvel encaissement, saisir un paiement"],
  [r.impayes, "Impayés"],
  [r.reversements, "Reversements"],
  [r.reversementLot, "Lot de virements"],
  [r.honoraires, "Honoraires"],
  [r.honorairesBareme, "Barème des honoraires"],
  [r.comptesRendus, "Comptes rendus"],
  [r.comptesRendusNew, "Nouveau compte rendu"],
  [r.messages, "Messages"],
  [r.messageNew, "Nouveau message"],
  [r.campagnes, "Campagnes"],
  [r.campagneNew, "Nouvelle campagne"],
  [r.interventions, "Interventions"],
  [r.interventionNew, "Nouvelle intervention"],
  [r.devis, "Devis à soumettre"],
  [r.conformite, "Conformité"],
  [r.documents, "Documents"],
  [r.documentAdd, "Ajouter un document"],
  [r.reglages, "Réglages, identité de l'agence"],
  [r.reglagesFinances, "Réglages, finances et honoraires"],
  [r.equipe, "Équipe"],
  [r.equipeInvitation, "Inviter un collaborateur"],
  [r.equipeRoles, "Rôles et droits"],
  [r.compte, "Mon compte"],
  [r.compteSecurite, "Connexion et sécurité"],
  [r.compteNotifications, "Notifications du compte"],
  [r.compteAbonnement, "Abonnement"],
  [r.aide, "Centre d'aide"],
];

export function buildSearchPages(): PageResult[] {
  const pages = new Map<string, string>(deliveredPages);
  for (const [href, label] of plannedScreens) if (!pages.has(href)) pages.set(href, label);
  return [
    ...Array.from(pages, ([href, label]) => ({ href, label })),
    ...demoMandants.map((mandant) => ({ href: mandantHref(mandant.id), label: `Mandant, ${mandant.name}` })),
    ...demoBiens.map((bien) => ({ href: bienHref(bien.id), label: `Lot, ${bien.name}, ${bien.street}` })),
    ...demoLocataires.filter((locataire) => !locataire.archived && locataire.id !== "chloe-martin").map((locataire) => ({ href: locataireHref(locataire.id), label: `Locataire, ${locataire.name}` })),
  ];
}
