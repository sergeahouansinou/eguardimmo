'use client';

import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Breadcrumb, Icon } from '@eguardimmo/ui';
import type { BadgeTone, BreadcrumbItem } from '@eguardimmo/ui';
import { CONSOLE_PRIVACY_TEXT } from '../copy';
import { useConsoleSupportConfig } from '../context';
import type { ConsolePriority } from '../model';
import type { SupportTicketStatus } from '../../model';

export const statusTone: Record<SupportTicketStatus, BadgeTone> = { open: 'info', waiting: 'warning', resolved: 'success' };
export const priorityTone: Record<ConsolePriority, BadgeTone> = { high: 'danger', normal: 'neutral', low: 'neutral' };

export function ConsoleHeader({ title, subtitle, breadcrumb, actions }: { title: string; subtitle?: string; breadcrumb?: BreadcrumbItem[]; actions?: ReactNode }) {
  const { Link } = useConsoleSupportConfig();
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

export function PrivacyNote() {
  return (
    <p className="flex items-start gap-1.5 text-caption text-fg-muted">
      <Icon icon={Info} size={14} className="mt-0.5 shrink-0" />
      <span>{CONSOLE_PRIVACY_TEXT}</span>
    </p>
  );
}
