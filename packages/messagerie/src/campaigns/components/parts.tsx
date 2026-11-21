'use client';

import type { ReactNode } from 'react';
import { Alert, Badge, Breadcrumb } from '@eguardimmo/ui';
import type { BadgeTone, BreadcrumbItem } from '@eguardimmo/ui';
import { useCampaignsConfig } from '../context';
import { ACCESS_DENIED_TEXT, statusLabels } from '../copy';
import type { CampaignStatus } from '../model';

const tones: Record<CampaignStatus, BadgeTone> = {
  draft: 'neutral',
  scheduled: 'info',
  sending: 'warning',
  sent: 'success',
  cancelled: 'neutral',
};

export function StatusBadge({ status }: { status: CampaignStatus }) {
  return <Badge tone={tones[status]}>{statusLabels[status]}</Badge>;
}

export interface CampaignHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: ReactNode;
}

export function CampaignHeader({ title, subtitle, breadcrumb, actions }: CampaignHeaderProps) {
  const { Link } = useCampaignsConfig();
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

export function CampaignsGuard({ children }: { children: ReactNode }) {
  const { capabilities } = useCampaignsConfig();
  if (!capabilities.manage) {
    return (
      <Alert tone="warning" title="Accès réservé">
        {ACCESS_DENIED_TEXT}
      </Alert>
    );
  }
  return children;
}
