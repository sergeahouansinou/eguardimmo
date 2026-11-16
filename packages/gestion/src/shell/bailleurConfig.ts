import {
  Building,
  CreditCard,
  Download,
  History,
  House,
  LifeBuoy,
  Settings,
  ShieldCheck,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { authUrl } from '@eguardimmo/shell';
import type {
  AccountMenuConfig,
  BottomItem,
  NotificationsConfig,
  PageResult,
} from '@eguardimmo/shell';
import { accountRoutes, plannedScreens } from '../navigation/routes';

export const bottomItems: BottomItem[] = [
  { id: 'accueil', label: 'Accueil', icon: House, href: '/' },
  { id: 'biens', label: 'Biens', icon: Building, href: '/biens' },
  { id: 'locataires', label: 'Locataires', icon: Users, href: '/locataires' },
  { id: 'finances', label: 'Finances', icon: Wallet, href: '/finances' },
];

const roleLabels = {
  owner: 'Titulaire',
  admin: 'Admin',
  manager: 'Gestionnaire',
  accountant: 'Comptable',
  gestionnaire: 'Gestionnaire',
  agent: 'Agent',
};

const accountGroups: AccountMenuConfig['groups'] = [
  {
    id: 'compte',
    label: 'Mon compte',
    items: [
      { id: 'mon-compte', label: 'Mon compte', href: accountRoutes.account, icon: User },
      { id: 'securite', label: 'Connexion et sécurité', href: accountRoutes.security, icon: ShieldCheck },
      {
        id: 'abonnement',
        label: 'Abonnement',
        href: accountRoutes.subscription,
        icon: CreditCard,
        meta: (shell) => shell.workspace.plan,
      },
      { id: 'export', label: 'Exporter mes données', href: accountRoutes.export, icon: Download },
    ],
  },
  {
    id: 'espace',
    label: 'Espace',
    items: [
      { id: 'reglages', label: 'Réglages', href: accountRoutes.settings, icon: Settings },
      {
        id: 'equipe',
        label: 'Équipe',
        href: accountRoutes.team,
        icon: Users,
        meta: ({ workspace }) => (workspace.members === undefined ? undefined : `${String(workspace.members)} membres`),
      },
      { id: 'journal', label: "Journal d'activité", href: accountRoutes.journal, icon: History },
    ],
  },
];

// Évalué au rendu et non à l'import : une adresse d'application manquante ne doit pas empêcher de charger le module.
export function accountMenu(): AccountMenuConfig {
  return {
    roleLabels,
    switchSpace: { href: authUrl('/profils') },
    signOut: { href: authUrl('/deconnecte') },
    groups: accountGroups,
    footerItems: [{ id: 'aide', label: "Centre d'aide", href: accountRoutes.help, icon: LifeBuoy }],
  };
}

export const notifications: NotificationsConfig = {
  allHref: accountRoutes.notifications,
  settingsHref: accountRoutes.notificationSettings,
};

export function searchPages(): PageResult[] {
  return [{ href: '/', label: 'Accueil' }, ...Array.from(plannedScreens(), ([href, label]) => ({ href, label }))];
}

export const SEARCH_PLACEHOLDER = 'Rechercher une page, ex. : Impayés';
export const SEARCH_NOTE = 'La recherche porte sur les pages. Biens, locataires et factures s’y ajouteront avec leurs écrans.';
