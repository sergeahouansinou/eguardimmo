import type { ReactNode } from 'react';
import { Breadcrumb } from '@eguardimmo/ui';
import type { BreadcrumbItem, LinkComponent } from '@eguardimmo/ui';
import { FlashAlert } from './flash';

export interface PageHeaderProps {
  Link: LinkComponent;
  crumbs: readonly BreadcrumbItem[];
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ Link, crumbs, title, description, actions }: PageHeaderProps) {
  return (
    <>
      <Breadcrumb items={crumbs} Link={Link} />
      <FlashAlert />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-page-title">{title}</h1>
          {description ? <p className="mt-0.5 text-body text-fg-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </>
  );
}
