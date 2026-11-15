import { Breadcrumb } from '@eguardimmo/ui';
import type { BreadcrumbItem } from '@eguardimmo/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  crumbs?: readonly BreadcrumbItem[];
}

export function PageHeader({ title, subtitle, badge, actions, crumbs }: PageHeaderProps) {
  return (
    <>
      {crumbs ? <Breadcrumb items={crumbs} Link={Link} /> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-page-title">{title}</h1>
            {badge}
          </div>
          {subtitle ? <p className="mt-0.5 text-body text-fg-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2 print:hidden">{actions}</div> : null}
      </div>
    </>
  );
}
