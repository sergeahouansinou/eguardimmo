'use client';

import type { ReactNode } from 'react';
import { Breadcrumb } from '@eguardimmo/ui';
import type { BreadcrumbItem } from '@eguardimmo/ui';
import { useAnnouncementsConfig } from '../context';

export interface AnnouncementHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: ReactNode;
}

export function AnnouncementHeader({ title, subtitle, breadcrumb, actions }: AnnouncementHeaderProps) {
  const { Link } = useAnnouncementsConfig();
  return (
    <header className="flex min-w-0 flex-col gap-2">
      {breadcrumb ? <Breadcrumb items={breadcrumb} Link={Link} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-page-title text-fg [overflow-wrap:anywhere]">{title}</h1>
          {subtitle ? <p className="text-body text-fg-muted [overflow-wrap:anywhere]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
