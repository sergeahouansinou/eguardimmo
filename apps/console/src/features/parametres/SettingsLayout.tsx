'use client';

import { cx } from '@eguardimmo/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { PageHeader } from '@/ui/PageHeader';

const SECTIONS = [
  { href: '/parametres', label: 'Général', title: 'Paramètres', subtitle: 'Domaines, e-mail d’envoi et limites de la plateforme.' },
  { href: '/parametres/securite', label: 'Sécurité', title: 'Sécurité', subtitle: 'Authentification des opérateurs, adresses autorisées et durée des sessions.' },
  { href: '/parametres/notifications', label: 'Notifications', title: 'Notifications', subtitle: 'Les alertes que vous recevez en tant qu’opérateur et les canaux utilisés.' },
  { href: '/parametres/informations', label: 'Informations', title: 'Informations', subtitle: 'Votre profil d’opérateur. Le rôle est attribué par un administrateur.' },
] as const;

export function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = SECTIONS.find((section) => section.href === pathname) ?? SECTIONS[0];
  return (
    <div className="flex max-w-[720px] flex-col gap-4">
      <PageHeader
        Link={Link}
        breadcrumb={[{ label: 'Paramètres', href: '/parametres' }, { label: current.label }]}
        title={current.title}
        subtitle={current.subtitle}
      />
      <nav aria-label="Sections des paramètres" className="flex gap-1 overflow-x-auto border-b border-line">
        {SECTIONS.map((section) => {
          const active = section.href === current.href;
          return (
            <Link
              key={section.href}
              href={section.href}
              aria-current={active ? 'page' : undefined}
              className={cx(
                '-mb-px inline-flex items-center border-b-2 px-2.5 py-2 text-body whitespace-nowrap',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                active ? 'border-action font-semibold text-action-on-subtle' : 'border-transparent font-medium text-fg-subtle hover:text-fg',
              )}
            >
              {section.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
