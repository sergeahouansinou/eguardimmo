import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ComponentType } from 'react';

export type LinkComponent = ComponentType<ComponentProps<'a'> & { href: string }>;

export interface NavLink {
  id: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  count?: number;
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

export function activeChildHref(children: NavLink[], currentPath: string): string | undefined {
  return children
    .filter((child) => isActiveHref(child.href, currentPath))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function isEntryActive(entry: NavEntry, currentPath: string): boolean {
  if (entry.children?.length) return entry.children.some((child) => isActiveHref(child.href, currentPath));
  return isActiveHref(entry.href, currentPath);
}
