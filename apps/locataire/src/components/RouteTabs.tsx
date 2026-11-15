'use client';

import { cx } from '@eguardimmo/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { focusRing } from './focus';

export interface RouteTab {
  label: string;
  href: string;
}

export function RouteTabs({ label, tabs }: { label: string; tabs: readonly RouteTab[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab) => {
        const active = pathname === tab.href || (tab.href === '/compte' && pathname === '/compte/modifier');
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              '-mb-px inline-flex items-center border-b-2 px-2.5 py-2 text-body whitespace-nowrap',
              active ? 'border-action font-semibold text-action-on-subtle' : 'border-transparent font-medium text-fg-subtle hover:text-fg',
              focusRing,
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const ACCOUNT_TABS: readonly RouteTab[] = [
  { label: 'Informations', href: '/compte' },
  { label: 'Sécurité', href: '/compte/securite' },
  { label: 'Notifications', href: '/notifications' },
];
