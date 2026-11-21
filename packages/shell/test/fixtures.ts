import { Building, CircleUser, House, Settings } from 'lucide-react';
import type { AccountMenuConfig, BottomItem, ShellNavigation } from '../src/config/types';
import type { ShellData } from '../src/data/schemas';
import type { ShellSource } from '../src/data/source';

export const testShell: ShellData = {
  user: { firstName: 'Awa', fullName: 'Awa Diallo', initials: 'AD', email: 'awa.diallo@example.com' },
  workspace: { name: 'Espace test', ownerName: 'Awa Diallo', role: 'admin', plan: 'Silver', members: 2 },
  counts: { lots: 4 },
  notifications: [
    { id: 'n1', tone: 'danger', title: 'Loyer impayé', detail: 'Il y a 2 j', unread: true, href: '/impayes' },
    { id: 'n2', tone: 'neutral', title: 'Bail renouvelé', detail: 'Hier', unread: false, href: '/baux' },
  ],
};

export function createTestSource(): ShellSource {
  let shell = structuredClone(testShell);
  return {
    shell: () => Promise.resolve(structuredClone(shell)),
    markAllNotificationsRead: () => {
      shell = { ...shell, notifications: shell.notifications.map((item) => ({ ...item, unread: false })) };
      return Promise.resolve();
    },
  };
}

export function testNavigation(counts?: Record<string, number>): ShellNavigation {
  return {
    sections: [
      {
        id: 'principal',
        label: 'Principal',
        entries: [
          { id: 'accueil', label: 'Accueil', href: '/', icon: House },
          { id: 'biens', label: 'Biens', href: '/biens', icon: Building, count: counts?.lots },
          { id: 'impayes', label: 'Impayés', href: '/impayes', icon: Building },
        ],
      },
    ],
    footer: [{ id: 'reglages', label: 'Réglages', href: '/reglages', icon: Settings }],
  };
}

export const testBottomItems: BottomItem[] = [
  { id: 'accueil', label: 'Accueil', icon: House, href: '/' },
  { id: 'biens', label: 'Biens', icon: Building, href: '/biens' },
];

export const testAccountMenu: AccountMenuConfig = {
  groups: [
    {
      id: 'compte',
      label: 'Mon compte',
      items: [{ id: 'compte', label: 'Mon compte', href: '/compte', icon: CircleUser, meta: (shell) => shell.workspace.plan }],
    },
  ],
  signOut: { href: '/deconnexion' },
  roleLabels: { admin: 'Admin' },
};

export const testPages = [
  { href: '/', label: 'Accueil' },
  { href: '/impayes', label: 'Impayés' },
  { href: '/documents/avis-echeance', label: "Avis d'échéance" },
];
