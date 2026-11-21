import {
  Activity,
  Archive,
  Building2,
  ClipboardCheck,
  CircleHelp,
  CircleUser,
  CreditCard,
  House,
  LifeBuoy,
  Puzzle,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import type {
  AccountMenuConfig,
  BottomItem,
  HelpMenuItem,
  NotificationsConfig,
  PageResult,
  ShellNavigation,
} from '@eguardimmo/shell';

import { canAccess } from '@/platform/roles';
import type { OperatorRole, Section } from '@/platform/roles';

export const SPACE_LABEL = 'Console opérateur';
export const RAIL_STORAGE_KEY = 'eg-nav-console';

export interface NavigationOptions {
  roles?: readonly OperatorRole[];
  api?: boolean;
}

const ENTRY_SECTION: Record<string, Section> = {
  'vue-ensemble': 'accueil',
  organisations: 'organisations',
  comptes: 'comptes',
  abonnements: 'abonnements',
  audit: 'audit',
  rgpd: 'rgpd',
  support: 'support',
  approbations: 'approbations',
  sante: 'sante',
  sauvegardes: 'sauvegardes',
  parametres: 'parametres',
  equipe: 'equipe',
};

const NOT_IN_API = new Set(['modules']);

function visible(entryId: string, { roles, api = false }: NavigationOptions): boolean {
  if (api && NOT_IN_API.has(entryId)) return false;
  const section = ENTRY_SECTION[entryId];
  if (roles === undefined || section === undefined) return true;
  return canAccess(roles, section);
}

export function navigation(counts: Readonly<Record<string, number>> | undefined, options: NavigationOptions = {}): ShellNavigation {
  const full = fullNavigation(counts);
  return {
    sections: full.sections
      .map((section) => ({ ...section, entries: section.entries.filter((entry) => visible(entry.id, options)) }))
      .filter((section) => section.entries.length > 0),
    footer: full.footer.filter((entry) => visible(entry.id, options)),
  };
}

function fullNavigation(counts: Readonly<Record<string, number>> | undefined): ShellNavigation {
  return {
    sections: [
      {
        id: 'exploitation',
        label: 'Exploitation',
        entries: [
          { id: 'vue-ensemble', label: "Vue d'ensemble", href: '/', icon: House },
          { id: 'organisations', label: 'Organisations', href: '/organisations', icon: Building2 },
          { id: 'comptes', label: 'Comptes et profils', href: '/comptes', icon: Users },
          { id: 'modules', label: 'Modules', href: '/modules', icon: Puzzle, count: counts?.modules },
          { id: 'abonnements', label: 'Abonnements', href: '/abonnements', icon: CreditCard },
        ],
      },
      {
        id: 'gouvernance',
        label: 'Gouvernance',
        entries: [
          { id: 'audit', label: "Journal d'audit", href: '/audit', icon: ScrollText },
          { id: 'approbations', label: 'Approbations', href: '/approbations', icon: ClipboardCheck, count: counts?.approbations },
          { id: 'rgpd', label: 'Conformité RGPD', href: '/rgpd', icon: ShieldCheck, count: counts?.rgpd },
          { id: 'support', label: 'Support', href: '/support', icon: LifeBuoy, count: counts?.support },
          { id: 'sante', label: 'Santé du système', href: '/sante', icon: Activity },
          { id: 'sauvegardes', label: 'Sauvegardes', href: '/sauvegardes', icon: Archive },
        ],
      },
    ],
    footer: [
      { id: 'parametres', label: 'Paramètres', href: '/parametres', icon: Settings },
      { id: 'equipe', label: 'Équipe opérateur', href: '/equipe', icon: UserCog },
    ],
  };
}

export const bottomItems: BottomItem[] = [
  { id: 'vue-ensemble', label: 'Ensemble', icon: House, href: '/' },
  { id: 'organisations', label: 'Organisations', icon: Building2, href: '/organisations' },
  { id: 'sante', label: 'Santé', icon: Activity, href: '/sante' },
  { id: 'audit', label: 'Audit', icon: ScrollText, href: '/audit' },
];

export const accountMenu: AccountMenuConfig = {
  roleLabels: { administrateur: 'Administrateur', operateur: 'Opérateur' },
  signOut: { href: '/deconnexion' },
  groups: [
    {
      id: 'compte',
      label: 'Mon compte',
      items: [
        { id: 'mon-compte', label: 'Informations de l’opérateur', href: '/parametres/informations', icon: CircleUser },
        { id: 'securite', label: 'Sécurité du compte', href: '/parametres/securite', icon: ShieldCheck },
      ],
    },
  ],
};

export const helpMenu: HelpMenuItem[] = [{ id: 'aide', label: 'Centre d’aide', href: '/aide', icon: CircleHelp }];

export const notifications: NotificationsConfig = {
  allHref: '/notifications',
  settingsHref: '/parametres/notifications',
};

export const searchPages: PageResult[] = [
  { href: '/', label: "Vue d'ensemble" },
  { href: '/organisations', label: 'Organisations' },
  { href: '/organisations/nouvelle', label: 'Nouvelle organisation' },
  { href: '/comptes', label: 'Comptes et profils' },
  { href: '/modules', label: 'Modules' },
  { href: '/abonnements', label: 'Abonnements' },
  { href: '/abonnements/plans/nouveau', label: 'Nouveau plan' },
  { href: '/audit', label: "Journal d'audit" },
  { href: '/rgpd', label: 'Conformité RGPD' },
  { href: '/support', label: 'Support' },
  { href: '/approbations', label: 'Approbations' },
  { href: '/sante', label: 'Santé du système' },
  { href: '/sauvegardes', label: 'Sauvegardes' },
  { href: '/sauvegardes/restauration', label: 'Restauration' },
  { href: '/parametres', label: 'Paramètres généraux' },
  { href: '/parametres/securite', label: 'Paramètres de sécurité' },
  { href: '/notifications', label: 'Toutes les notifications' },
  { href: '/parametres/notifications', label: 'Préférences de notifications' },
  { href: '/parametres/informations', label: 'Informations de l’opérateur' },
  { href: '/equipe', label: 'Équipe opérateur' },
  { href: '/equipe/inviter', label: 'Inviter un opérateur' },
  { href: '/aide', label: 'Centre d’aide' },
];
