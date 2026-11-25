import {
  ArrowLeftRight,
  Banknote,
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarCheck,
  ChartPie,
  CalendarDays,
  ClipboardList,
  History,
  NotebookTabs,
  CircleAlert,
  CircleQuestionMark,
  CircleUser,
  Contact,
  CreditCard,
  FilePenLine,
  FileSpreadsheet,
  FileText,
  Folder,
  Handshake,
  House,
  KeyRound,
  Landmark,
  LifeBuoy,
  Megaphone,
  Newspaper,
  MessageSquare,
  Percent,
  Receipt,
  ReceiptText,
  Scale,
  ScrollText,
  Settings,
  Users,
  UsersRound,
  Wallet,
  Wrench,
  Bell,
} from "lucide-react";
import { authUrl } from "@eguardimmo/shell";
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
import type { NavEntry } from "@eguardimmo/ui";
import { demoBiens, demoMandants } from "@/features/portefeuille/demoCore";
import { demoLocataires } from "@/features/portefeuille/demoBaux";
import { agenceRoutes as r, bienHref, locataireHref, mandantHref } from "./routes";

export const SPACE_LABEL = "Espace agence sous mandat";
export const RAIL_STORAGE_KEY = "eg-nav-agence";
export const SEARCH_PLACEHOLDER = "Rechercher, ex. : Marc Chevalier, Apt 12, Impayés";
export const SEARCH_NOTE = "La recherche porte sur les pages, les mandants, les lots et les locataires.";
export const SEARCH_PLACEHOLDER_API = "Rechercher une page, ex. : Impayés";
export const SEARCH_NOTE_API = "La recherche porte sur les pages. Mandants, biens et locataires s’y ajouteront avec leurs écrans.";

export interface SupportNavigation {
  manageAccess: boolean;
  requests?: number | undefined;
  access?: number | undefined;
}

export interface TenantRequestsNavigation {
  manage: boolean;
  payments: boolean;
}

export interface NavigationOptions {
  rent: boolean;
  invoicing?: boolean;
  ownerFunds?: boolean;
  charges?: boolean;
  banking?: boolean;
  tenantRequests?: TenantRequestsNavigation;
  support?: SupportNavigation;
  planning?: boolean;
  contacts?: boolean;
  activity?: boolean;
  tax?: boolean;
  analytics?: boolean;
  timezone?: boolean;
  accounting?: boolean;
  listings?: boolean;
  settingsAdmin?: boolean;
}

function settingsEntry(options: NavigationOptions): NavEntry {
  const entry: NavEntry = { id: "reglages", label: "Réglages", href: r.reglages, icon: Settings };
  const manageAccess = options.support?.manageAccess === true;
  const timezone = options.timezone === true;
  const admin = options.settingsAdmin === true;
  if (!manageAccess && !timezone && !admin) return entry;
  return {
    ...entry,
    ...(options.support?.access ? { count: options.support.access } : {}),
    children: [
      { id: "reglages-identite", label: "Identité", href: r.reglages },
      ...(timezone ? [{ id: "reglages-fuseau", label: "Fuseau horaire", href: r.reglagesFuseau }] : []),
      ...(admin ? [{ id: "reglages-champs", label: "Champs personnalisés", href: r.reglagesChamps }, { id: "reglages-rgpd", label: "Demandes RGPD", href: r.reglagesRgpd }] : []),
      ...(manageAccess ? [{ id: "reglages-acces-support", label: "Accès du support", href: r.reglagesAccesSupport }] : []),
    ],
  };
}

const accountingEntry: NavEntry = {
  id: "comptabilite",
  label: "Comptabilité",
  href: r.comptabilite,
  icon: BookOpen,
  children: [
    { id: "comptabilite-plan", label: "Plan comptable", href: r.comptabilite },
    { id: "comptabilite-ecritures", label: "Écritures", href: r.comptabiliteEcritures },
    { id: "comptabilite-releve", label: "Relevé de bail", href: r.comptabiliteReleve },
  ],
};

function bauxEntry(tenantRequests: TenantRequestsNavigation | undefined): NavEntry {
  const entry: NavEntry = { id: "baux", label: "Baux", href: r.baux, icon: FilePenLine };
  if (!tenantRequests?.manage) return entry;
  return {
    ...entry,
    children: [
      { id: "baux-liste", label: "Tous les baux", href: r.baux },
      { id: "baux-conges", label: "Demandes de congé", href: r.conges },
      { id: "baux-etats-des-lieux", label: "États des lieux", href: r.etatsLieux },
    ],
  };
}

function conformiteEntry(tenantRequests: TenantRequestsNavigation | undefined): NavEntry {
  const entry: NavEntry = { id: "conformite", label: "Conformité", href: r.conformite, icon: BadgeCheck };
  if (!tenantRequests?.manage) return entry;
  return {
    ...entry,
    children: [
      { id: "conformite-pieces", label: "Pièces de conformité", href: r.conformite },
      { id: "conformite-assurances", label: "Assurances des locataires", href: r.assurances },
    ],
  };
}

function supportEntries(support: SupportNavigation | undefined): NavEntry[] {
  if (support === undefined) return [];
  return [{ id: "support", label: "Support", href: r.support, icon: LifeBuoy, ...(support.requests ? { count: support.requests } : {}) }];
}

export function buildNavigation(counts?: ShellCounts, options: NavigationOptions = { rent: false }): ShellNavigation {
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
          bauxEntry(options.tenantRequests),
        ],
      },
      {
        id: "finances",
        label: "Finances",
        entries: [
          ...(options.rent ? [{ id: "loyers", label: "Loyers", href: r.loyers, icon: ReceiptText }] : []),
          ...(options.invoicing ? [{ id: "factures", label: "Factures", href: r.factures, icon: FileText }] : []),
          { id: "encaissements", label: "Encaissements", href: r.encaissements, icon: Banknote },
          { id: "impayes", label: "Impayés", href: r.impayes, icon: CircleAlert, count: counts?.impayes, activeFor: [r.recouvrement] },
          { id: "reversements", label: "Reversements", href: r.reversements, icon: Wallet, count: counts?.reversements },
          { id: "honoraires", label: "Honoraires", href: r.honoraires, icon: Percent },
          ...(options.accounting ? [accountingEntry] : []),
          ...(options.ownerFunds
            ? [
                { id: "fonds", label: "Fonds de tiers", href: r.fonds, icon: Landmark },
                { id: "cloture", label: "Clôture mensuelle", href: r.cloture, icon: CalendarCheck },
              ]
            : []),
          ...(options.banking ? [{ id: "banque", label: "Banque", href: r.banque, icon: ArrowLeftRight }] : []),
          ...(options.charges
            ? [
                { id: "depenses", label: "Dépenses", href: r.depenses, icon: Receipt },
                { id: "charges", label: "Régularisation des charges", href: r.charges, icon: Scale },
              ]
            : []),
          ...(options.tenantRequests?.payments ? [{ id: "paiements-en-ligne", label: "Paiements en ligne", href: r.paiementsEnLigne, icon: CreditCard }] : []),
          { id: "comptes-rendus", label: "Comptes rendus", href: r.comptesRendus, icon: ScrollText, count: counts?.comptesRendus },
          ...(options.tax ? [{ id: "fiscalite", label: "Fiscalité des mandants", href: r.fiscalite, icon: FileSpreadsheet }] : []),
          ...(options.analytics ? [{ id: "analytique", label: "Analytique", href: r.analytique, icon: ChartPie }] : []),
        ],
      },
      {
        id: "suivi",
        label: "Suivi",
        entries: [
          { id: "messages", label: "Messages", href: r.messages, icon: MessageSquare, count: counts?.messages },
          { id: "campagnes", label: "Campagnes", href: r.campagnes, icon: Megaphone },
          ...(options.listings ? [{ id: "annonces", label: "Annonces", href: r.annonces, icon: Newspaper }] : []),
          ...(options.planning ? [{ id: "agenda", label: "Agenda", href: r.agenda, icon: CalendarDays }, { id: "taches", label: "Tâches", href: r.taches, icon: ClipboardList }] : []),
          ...(options.contacts ? [{ id: "contacts", label: "Contacts", href: r.contacts, icon: NotebookTabs }] : []),
          { id: "interventions", label: "Interventions", href: r.interventions, icon: Wrench, count: counts?.interventions },
          conformiteEntry(options.tenantRequests),
          { id: "documents", label: "Documents", href: r.documents, icon: Folder },
        ],
      },
    ],
    footer: [
      settingsEntry(options),
      ...(options.activity ? [{ id: "journal", label: "Journal d’activité", href: r.journal, icon: History }] : []),
      { id: "equipe", label: "Équipe", href: r.equipe, icon: UsersRound },
      ...supportEntries(options.support),
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
  roleLabels: {
    admin: "Administrateur",
    gestionnaire: "Gestionnaire",
    comptable: "Comptable",
    owner: "Titulaire",
    manager: "Gestionnaire",
    accountant: "Comptable",
  },
  switchSpace: { href: authUrl("/profils") },
  signOut: { href: authUrl("/deconnecte") },
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

export const plannedScreens: ReadonlyMap<string, string> = new Map();

export const deliveredPages: readonly (readonly [href: string, label: string])[] = [
  [r.home, "Accueil"],
  [r.mandants, "Mandants"],
  [r.mandantNew, "Nouveau mandant"],
  [r.mandats, "Mandats"],
  [r.mandatNew, "Nouveau mandat"],
  [r.mandatAvenant, "Nouvel avenant"],
  [r.biens, "Biens sous mandat"],
  [r.bienNew, "Nouveau bien"],
  [r.locataires, "Locataires"],
  [r.locataireInvitation, "Inviter un locataire"],
  [r.baux, "Baux"],
  [r.bailNew, "Nouveau bail"],
  [r.avisEcheance, "Avis d'échéance"],
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
  [r.notifications, "Toutes les notifications"],
  [r.compteAbonnement, "Abonnement"],
  [r.aide, "Centre d'aide"],
];

export const bankingPages: readonly (readonly [href: string, label: string])[] = [
  [r.banque, "Banque, pointage des lignes de relevé"],
  [r.banqueComptes, "Comptes bancaires suivis"],
  [r.banqueReleves, "Relevés bancaires importés"],
  [r.banqueImport, "Importer un relevé bancaire"],
  [r.banqueEtats, "États de rapprochement bancaire"],
];

export const tenantRequestManagePages: readonly (readonly [href: string, label: string])[] = [
  [r.conges, "Demandes de congé des locataires"],
  [r.assurances, "Assurances des locataires, attestations à examiner"],
];

export const tenantRequestPaymentPages: readonly (readonly [href: string, label: string])[] = [[r.paiementsEnLigne, "Paiements en ligne, compte de paiement et statuts"]];

export const apiOnlyPages: readonly (readonly [href: string, label: string])[] = [
  [r.messagesTeam, "Messages de l’équipe"],
  [r.locataireNew, "Nouveau locataire"],
  [r.candidats, "Candidats locataires"],
  [r.candidatInvitation, "Inviter un candidat"],
  [r.etatsLieux, "États des lieux"],
  ...tenantRequestManagePages,
  ...tenantRequestPaymentPages,
  [r.etatLieuxNew, "Nouvel état des lieux"],
  [r.reservations, "Réservations"],
  [r.reservationNew, "Nouvelle réservation"],
  [r.immeubles, "Immeubles"],
  [r.immeubleNew, "Nouvel immeuble"],
  [r.equipements, "Équipements"],
  [r.equipementNew, "Nouvel équipement"],
  [r.releves, "Relevés de compteurs"],
  [r.inventaires, "Inventaires"],
  [r.equipeInviter, "Inviter un membre"],
  [r.loyers, "Loyers, échéances et avis"],
  [r.loyersPaiements, "Paiements de loyer"],
  [r.loyerPaiementNew, "Enregistrer un paiement de loyer"],
  [r.loyersQuittances, "Quittances de loyer"],
  [r.recouvrement, "Recouvrement, dossiers et commissaire de justice"],
  [r.factures, "Factures et avoirs"],
  [r.factureNew, "Nouvelle facture"],
  [r.interventionSuppliers, "Prestataires"],
  [r.reversementsIban, "Changements d’IBAN des propriétaires, demandes à valider"],
  [r.fonds, "Fonds de tiers, cantonnement"],
  [r.cloture, "Clôture mensuelle"],
  [r.depenses, "Dépenses, factures et relevés de l’immeuble"],
  [r.depenseNew, "Nouvelle dépense, saisir une facture"],
  [r.charges, "Régularisation des charges, exercices et décomptes"],
  [r.chargeNew, "Nouvel exercice de charges"],
  [r.chargesCles, "Clés de répartition des charges"],
  [r.comptesRendusReleve, "Relevé d’un mandant"],
  [r.support, "Support, mes demandes"],
  [r.supportNew, "Nouvelle demande au support"],
  [r.reglagesAccesSupport, "Réglages, accès du support à vos données"],
  [r.agenda, "Agenda, rendez-vous, visites et échéances"],
  [r.agendaNew, "Nouvel événement"],
  [r.taches, "Tâches et rappels"],
  [r.tacheNew, "Nouvelle tâche"],
  [r.contacts, "Contacts, annuaire de l’agence"],
  [r.contactNew, "Nouveau contact"],
  [r.journal, "Journal d’activité"],
  [r.reglagesFuseau, "Réglages, fuseau horaire de l’organisation"],
  [r.fiscalite, "Fiscalité des mandants, relevés fiscaux"],
  [r.analytique, "Analytique, revenus, dépenses et occupation"],
  [r.analytiqueRevenus, "Analytique, revenus et dépenses"],
  [r.analytiqueOccupation, "Analytique, occupation des lots"],
];

export const accountingPages: readonly (readonly [href: string, label: string])[] = [
  [r.comptabilite, "Comptabilité, plan comptable"],
  [r.comptabiliteEcritures, "Comptabilité, écritures"],
  [r.comptabiliteReleve, "Comptabilité, relevé de bail"],
];

export const listingPages: readonly (readonly [href: string, label: string])[] = [
  [r.annonces, "Annonces"],
  [r.annonceNew, "Nouvelle annonce"],
];

export const settingsAdminPages: readonly (readonly [href: string, label: string])[] = [
  [r.reglagesChamps, "Réglages, champs personnalisés"],
  [r.reglagesRgpd, "Réglages, demandes RGPD"],
];

export interface SearchOptions {
  records: boolean;
  banking?: boolean;
  tenantRequests?: TenantRequestsNavigation;
  accounting?: boolean;
  listings?: boolean;
  settingsAdmin?: boolean;
}

export function buildSearchPages(options: SearchOptions = { records: true }): PageResult[] {
  const tenantPages = [...(options.tenantRequests?.manage === true ? tenantRequestManagePages : []), ...(options.tenantRequests?.payments === true ? tenantRequestPaymentPages : [])];
  const gated = new Set([r.etatsLieux, ...tenantRequestManagePages.map(([href]) => href), ...tenantRequestPaymentPages.map(([href]) => href)]);
  const pages = new Map<string, string>(options.records ? deliveredPages : [...deliveredPages, ...apiOnlyPages.filter(([href]) => !gated.has(href) || (href === r.etatsLieux && options.tenantRequests?.manage === true)), ...(options.banking === true ? bankingPages : []), ...tenantPages]);
  const granted = [...(options.accounting === true ? accountingPages : []), ...(options.listings === true ? listingPages : []), ...(options.settingsAdmin === true ? settingsAdminPages : [])];
  for (const [href, label] of granted) pages.set(href, label);
  for (const [href, label] of plannedScreens) if (!pages.has(href)) pages.set(href, label);
  const labelled = Array.from(pages, ([href, label]) => ({ href, label }));
  if (!options.records) return labelled;
  return [
    ...labelled,
    ...demoMandants.map((mandant) => ({ href: mandantHref(mandant.id), label: `Mandant, ${mandant.name}` })),
    ...demoBiens.map((bien) => ({ href: bienHref(bien.id), label: `Lot, ${bien.name}, ${bien.street}` })),
    ...demoLocataires.filter((locataire) => !locataire.archived && locataire.id !== "chloe-martin").map((locataire) => ({ href: locataireHref(locataire.id), label: `Locataire, ${locataire.name}` })),
  ];
}
