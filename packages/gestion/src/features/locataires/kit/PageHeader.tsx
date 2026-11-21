'use client';

import { Breadcrumb, Button, Icon } from '@eguardimmo/ui';
import type { BreadcrumbItem, ButtonVariant } from '@eguardimmo/ui';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useGestionNavigation } from './navigation';

export function PageHeader({
  crumbs,
  title,
  subtitle,
  badges,
  lead,
  actions,
}: {
  crumbs: readonly BreadcrumbItem[];
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  const { Link } = useGestionNavigation();
  return (
    <header className="flex flex-col gap-2">
      <Breadcrumb items={crumbs} Link={Link} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {lead}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-page-title [overflow-wrap:anywhere]">{title}</h1>
              {badges}
            </div>
            {subtitle ? <p className="mt-0.5 text-body text-fg-muted [overflow-wrap:anywhere]">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function LinkButton({
  href,
  variant = 'secondary',
  size = 'md',
  icon,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  icon?: LucideIcon;
  children: ReactNode;
}) {
  const { Link } = useGestionNavigation();
  return (
    <Button variant={variant} size={size} asChild>
      <Link href={href}>
        {icon ? <Icon icon={icon} /> : null}
        {children}
      </Link>
    </Button>
  );
}
