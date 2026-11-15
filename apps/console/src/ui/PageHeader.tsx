import type { ReactNode } from 'react';
import { Breadcrumb } from '@eguardimmo/ui';
import type { BreadcrumbItem, LinkComponent } from '@eguardimmo/ui';

export interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  badges?: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: readonly BreadcrumbItem[];
  Link: LinkComponent;
}

export function PageHeader({ title, subtitle, badges, lead, actions, breadcrumb, Link }: PageHeaderProps) {
  return (
    <>
      {breadcrumb ? <Breadcrumb items={breadcrumb} Link={Link} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-80 items-start gap-3">
          {lead}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-page-title">{title}</h1>
              {badges}
            </div>
            {subtitle ? <p className="mt-0.5 text-body text-fg-muted">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2 max-sm:w-full [&>*]:max-sm:flex-1">{actions}</div> : null}
      </div>
    </>
  );
}
