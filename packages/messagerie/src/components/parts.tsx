'use client';

import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert, Badge, Breadcrumb, Button, EmptyState, Spinner, cx } from '@eguardimmo/ui';
import type { BadgeTone, BreadcrumbItem } from '@eguardimmo/ui';
import { useMessagerieConfig } from '../config';
import type { ParticipantRole } from '../data/schemas';

export const roleLabels: Record<ParticipantRole, string> = {
  locataire: 'Locataire',
  mandant: 'Mandant',
  proprietaire: 'Propriétaire',
  agence: 'Agence',
  gestionnaire: 'Gestionnaire',
  bailleur: 'Bailleur',
  support: 'Support',
  operateur: 'Opérateur',
};

export const roleTones: Record<ParticipantRole, BadgeTone> = {
  locataire: 'info',
  mandant: 'success',
  proprietaire: 'success',
  agence: 'neutral',
  gestionnaire: 'neutral',
  bailleur: 'neutral',
  support: 'info',
  operateur: 'neutral',
};

export function RoleBadge({ role }: { role: ParticipantRole }) {
  return <Badge tone={roleTones[role]}>{roleLabels[role]}</Badge>;
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-8 text-body text-fg-muted">
      <Spinner label={label} />
      <span aria-hidden="true">{label}</span>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert tone="danger" title={message}>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
          Réessayer
        </Button>
      ) : null}
    </Alert>
  );
}

export function EmptyBlock({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <EmptyState
      icon={Inbox}
      title={title}
      description={hint}
      className="rounded-lg border border-dashed border-line-control bg-surface py-10"
    >
      {action}
    </EmptyState>
  );
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, breadcrumb, actions, className }: PageHeaderProps) {
  const { Link } = useMessagerieConfig();
  return (
    <header className={cx('flex min-w-0 flex-col gap-2', className)}>
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
