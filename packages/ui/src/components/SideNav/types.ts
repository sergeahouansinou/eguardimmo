import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ComponentType } from 'react';

export type LinkComponent = ComponentType<ComponentProps<'a'> & { href: string }>;

export interface NavLink {
  id: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  count?: number;
  activeFor?: string[];
}

export interface NavEntry extends NavLink {
  icon: LucideIcon;
  children?: NavLink[];
}

export interface NavSection {
  id: string;
  label: string;
  entries: NavEntry[];
}

export function isActiveHref(href: string, currentPath: string): boolean {
  if (href === '/') return currentPath === '/';
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function matchLength(link: NavLink, currentPath: string): number {
  return [link.href, ...(link.activeFor ?? [])].filter((href) => isActiveHref(href, currentPath)).reduce((best, href) => Math.max(best, href.length), -1);
}

export function activeChildHref(children: NavLink[], currentPath: string): string | undefined {
  return children
    .map((child) => ({ href: child.href, length: matchLength(child, currentPath) }))
    .filter((match) => match.length >= 0)
    .sort((a, b) => b.length - a.length)[0]?.href;
}

export function isEntryActive(entry: NavEntry, currentPath: string): boolean {
  if (entry.children?.length) return entry.children.some((child) => matchLength(child, currentPath) >= 0);
  return isActiveHref(entry.href, currentPath);
}
