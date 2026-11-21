'use client';

import { Breadcrumb } from '@eguardimmo/ui';
import type { BreadcrumbItem } from '@eguardimmo/ui';
import type { ReactNode } from 'react';
import { useBiensEnvironment } from '../environment';

export interface PageHeaderProps {
  crumbs: readonly BreadcrumbItem[];
  title: string;
  badges?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ crumbs, title, badges, subtitle, actions }: PageHeaderProps) {
  const { Link } = useBiensEnvironment();
  return (
    <header className="flex flex-col gap-2">
      <Breadcrumb items={crumbs} Link={Link} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-page-title [overflow-wrap:anywhere]">{title}</h1>
            {badges}
          </div>
          {subtitle ? <p className="mt-0.5 text-body text-fg-muted [overflow-wrap:anywhere]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
