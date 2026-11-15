import {
  Building,
  CircleQuestionMark,
  CircleUser,
  CreditCard,
  Download,
  House,
  KeyRound,
  ScrollText,
  Settings,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react';
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

export const accountMenu: AccountMenuConfig = {
  roleLabels: { admin: 'Admin', gestionnaire: 'Gestionnaire', agent: 'Agent' },
  switchSpace: { href: accountRoutes.profiles },
  signOut: { href: accountRoutes.signOut },
  groups: [
    {
      id: 'compte',
      label: 'Mon compte',
      items: [
        { id: 'mon-compte', label: 'Mon compte', href: accountRoutes.account, icon: CircleUser },
        { id: 'securite', label: 'Connexion et sécurité', href: accountRoutes.security, icon: KeyRound },
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
          icon: UsersRound,
          meta: ({ workspace }) => (workspace.members === undefined ? undefined : `${String(workspace.members)} membres`),
        },
        { id: 'journal', label: "Journal d'activité", href: accountRoutes.journal, icon: ScrollText },
      ],
    },
  ],
  footerItems: [{ id: 'aide', label: "Centre d'aide", href: accountRoutes.help, icon: CircleQuestionMark }],
};

export const notifications: NotificationsConfig = {
  allHref: accountRoutes.notifications,
  settingsHref: accountRoutes.notificationSettings,
};

export function searchPages(): PageResult[] {
  return [{ href: '/', label: 'Accueil' }, ...Array.from(plannedScreens(), ([href, label]) => ({ href, label }))];
}

export const SEARCH_PLACEHOLDER = 'Rechercher une page, ex. : Impayés';
export const SEARCH_NOTE = 'La recherche porte sur les pages. Biens, locataires et factures s’y ajouteront avec leurs écrans.';
