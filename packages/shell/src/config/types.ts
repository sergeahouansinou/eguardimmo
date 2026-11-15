import type { LucideIcon } from 'lucide-react';
import type { NavEntry, NavLink, NavSection } from '@eguardimmo/ui';
import type { ShellCounts, ShellData } from '../data/schemas';

export interface ShellNavigation {
  sections: NavSection[];
  footer: NavEntry[];
}

export type NavigationSource = ShellNavigation | ((counts: ShellCounts | undefined) => ShellNavigation);

export interface BottomItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

export interface AddMenuGroup {
  label: string;
  items: NavLink[];
}

export interface HelpMenuItem extends NavLink {
  shortcut?: string;
  separatorBefore?: boolean;
}

export interface AccountMenuItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  meta?: (shell: ShellData) => string | undefined;
}

export interface AccountMenuGroup {
  id: string;
  label: string;
  items: AccountMenuItem[];
}

export interface AccountMenuConfig {
  groups: AccountMenuGroup[];
  footerItems?: AccountMenuItem[];
  switchSpace?: { href: string };
  signOut: { href: string };
  roleLabels?: Record<string, string>;
}

export interface PageResult {
  href: string;
  label: string;
}

export interface NotificationsConfig {
  allHref: string;
  settingsHref?: string;
}

export function resolveNavigation(source: NavigationSource, counts: ShellCounts | undefined): ShellNavigation {
  return typeof source === 'function' ? source(counts) : source;
}
