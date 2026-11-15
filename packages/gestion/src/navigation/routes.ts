import {
  BookUser,
  Building,
  Calendar,
  ChartColumn,
  ChartPie,
  FilePenLine,
  Folder,
  House,
  ListChecks,
  MessageSquare,
  Settings,
  Users,
  UsersRound,
  Wallet,
  Wrench,
} from 'lucide-react';
import type { NavLink } from '@eguardimmo/ui';
import type { HelpMenuItem, ShellCounts, ShellNavigation } from '@eguardimmo/shell';

export type Navigation = ShellNavigation;

export function buildNavigation(counts?: ShellCounts): Navigation {
  return {
    sections: [
      {
        id: 'principal',
        label: 'Principal',
        entries: [
          { id: 'accueil', label: 'Accueil', href: '/', icon: House },
          {
            id: 'biens',
            label: 'Biens',
            href: '/biens',
            icon: Building,
            count: counts?.lots,
            children: [
              { id: 'lots', label: 'Lots', href: '/biens' },
              { id: 'immeubles', label: 'Immeubles', href: '/biens/immeubles' },
              { id: 'equipements', label: 'Équipements', href: '/biens/equipements' },
              { id: 'releves', label: 'Relevés de compteurs', href: '/biens/releves' },
              { id: 'inventaires', label: 'Inventaires', href: '/biens/inventaires' },
            ],
          },
          {
            id: 'locataires',
            label: 'Locataires',
            href: '/locataires',
            icon: Users,
            count: counts?.tenants,
            children: [
              { id: 'liste-locataires', label: 'Locataires', href: '/locataires' },
              { id: 'candidats', label: 'Candidats', href: '/locataires/candidats' },
            ],
          },
          {
            id: 'baux',
            label: 'Baux',
            href: '/baux',
            icon: FilePenLine,
            children: [
              { id: 'liste-baux', label: 'Baux', href: '/baux' },
              { id: 'etats-des-lieux', label: 'États des lieux', href: '/baux/etats-des-lieux' },
              { id: 'reservations', label: 'Réservations', href: '/baux/reservations' },
            ],
          },
          {
            id: 'finances',
            label: 'Finances',
            href: '/finances',
            icon: Wallet,
            children: [
              { id: 'operations', label: 'Opérations', href: '/finances' },
              { id: 'impayes', label: 'Impayés', href: '/finances/impayes', activeFor: ['/finances/recouvrement'] },
              { id: 'factures', label: 'Factures', href: '/finances/factures' },
              { id: 'regularisation', label: 'Régularisation', href: '/finances/regularisation' },
              { id: 'bilan', label: 'Bilan', href: '/finances/bilan' },
              { id: 'prets', label: 'Prêts', href: '/finances/prets' },
              { id: 'import-bancaire', label: 'Import bancaire', href: '/finances/import-bancaire' },
            ],
          },
          {
            id: 'documents',
            label: 'Documents',
            href: '/documents',
            icon: Folder,
            children: [
              { id: 'mes-documents', label: 'Mes documents', href: '/documents' },
              { id: 'quittances', label: 'Quittances', href: '/documents/quittances' },
              { id: 'avis-echeance', label: "Avis d'échéance", href: '/documents/avis-echeance' },
              { id: 'courriers', label: 'Courriers', href: '/documents/courriers' },
              { id: 'signatures', label: 'Signatures', href: '/documents/signatures' },
            ],
          },
        ],
      },
      {
        id: 'suivi',
        label: 'Suivi',
        entries: [
          { id: 'messages', label: 'Messages', href: '/messages', icon: MessageSquare, count: counts?.unreadMessages },
          { id: 'interventions', label: 'Interventions', href: '/interventions', icon: Wrench, count: counts?.openInterventions },
          { id: 'agenda', label: 'Agenda', href: '/agenda', icon: Calendar },
          { id: 'taches', label: 'Tâches et rappels', href: '/taches', icon: ListChecks },
        ],
      },
      {
        id: 'outils',
        label: 'Outils',
        entries: [
          {
            id: 'analytique',
            label: 'Analytique',
            href: '/analytique',
            icon: ChartPie,
            children: [
              { id: 'vue', label: "Vue d'ensemble", href: '/analytique' },
              { id: 'revenus-depenses', label: 'Revenus et dépenses', href: '/analytique/revenus-depenses' },
              { id: 'previsionnel', label: 'Prévisionnel', href: '/analytique/previsionnel' },
              { id: 'occupation', label: 'Occupation', href: '/analytique/occupation' },
              { id: 'rentabilite', label: 'Rentabilité par bien', href: '/analytique/rentabilite' },
            ],
          },
          { id: 'rapports', label: 'Rapports', href: '/rapports', icon: ChartColumn },
          { id: 'modeles', label: 'Modèles de courriers', href: '/modeles', icon: FilePenLine },
          { id: 'contacts', label: 'Contacts', href: '/contacts', icon: BookUser },
        ],
      },
    ],
    footer: [
      { id: 'reglages', label: 'Réglages', href: '/reglages', icon: Settings },
      { id: 'equipe', label: 'Équipe', href: '/equipe', icon: UsersRound },
    ],
  };
}

export interface MenuGroupDef {
  label: string;
  items: NavLink[];
}

export const addMenu: MenuGroupDef[] = [
  {
    label: 'Biens et locataires',
    items: [
      { id: 'nouveau-bien', label: 'Nouveau bien', href: '/biens/nouveau' },
      { id: 'nouveau-locataire', label: 'Nouveau locataire', href: '/locataires/nouveau' },
      { id: 'nouveau-bail', label: 'Nouveau bail', href: '/baux/nouveau' },
    ],
  },
  {
    label: 'Finances',
    items: [
      { id: 'nouvel-encaissement', label: 'Nouvel encaissement', href: '/finances/encaissements/nouveau' },
      { id: 'nouvelle-depense', label: 'Nouvelle dépense', href: '/finances/depenses/nouvelle' },
    ],
  },
  {
    label: 'Suivi et documents',
    items: [
      { id: 'nouvelle-intervention', label: 'Nouvelle intervention', href: '/interventions/nouvelle' },
      { id: 'nouvelle-tache', label: 'Nouvelle tâche', href: '/taches/nouvelle' },
      { id: 'nouveau-message', label: 'Nouveau message', href: '/messages/nouveau' },
      { id: 'nouvelle-campagne', label: 'Nouvelle campagne', href: '/campagnes/nouvelle' },
      { id: 'nouveau-document', label: 'Nouveau document', href: '/documents/nouveau' },
    ],
  },
];

export const helpMenu: HelpMenuItem[] = [
  { id: 'centre-aide', label: "Centre d'aide", href: '/aide' },
  { id: 'support', label: 'Discuter avec le support', href: '/aide/support' },
  { id: 'raccourcis', label: 'Raccourcis clavier', href: '/aide/raccourcis', shortcut: '?' },
  { id: 'nouveautes', label: 'Nouveautés', href: '/aide/nouveautes', separatorBefore: true },
  { id: 'signaler', label: 'Signaler un problème', href: '/aide/signaler' },
];

export const accountRoutes = {
  account: '/compte',
  security: '/compte/securite',
  subscription: '/compte/abonnement',
  export: '/compte/export',
  settings: '/reglages',
  team: '/equipe',
  journal: '/journal',
  help: '/aide',
  notifications: '/notifications',
  notificationSettings: '/reglages/notifications',
  encaisser: '/finances/encaissements/nouveau',
  depense: '/finances/depenses/nouvelle',
  analytique: '/analytique',
  agenda: '/agenda',
  todos: '/taches',
} as const;

const extraTitles: Record<string, string> = {
  [accountRoutes.account]: 'Mon compte',
  [accountRoutes.security]: 'Connexion et sécurité',
  [accountRoutes.subscription]: 'Abonnement',
  [accountRoutes.export]: 'Exporter mes données',
  [accountRoutes.journal]: "Journal d'activité",
  [accountRoutes.notificationSettings]: 'Réglages des notifications',
};

export function plannedScreens(): Map<string, string> {
  const navigation = buildNavigation();
  const screens = new Map<string, string>();
  const entries = [...navigation.sections.flatMap((section) => section.entries), ...navigation.footer];
  for (const entry of entries) {
    if (entry.href !== '/') screens.set(entry.href, entry.label);
    for (const child of entry.children ?? []) screens.set(child.href, child.label);
  }
  for (const item of [...addMenu.flatMap((group) => group.items), ...helpMenu]) screens.set(item.href, item.label);
  for (const [href, title] of Object.entries(extraTitles)) screens.set(href, title);
  return screens;
}
