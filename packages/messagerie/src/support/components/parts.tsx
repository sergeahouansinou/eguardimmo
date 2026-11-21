'use client';

import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert, Badge, Breadcrumb, Icon } from '@eguardimmo/ui';
import type { BreadcrumbItem } from '@eguardimmo/ui';
import { SUPPORT_PRIVACY_TEXT } from '../copy';
import { useSupportConfig } from '../context';
import { useSupportAvailability } from '../queries';

export function SupportHeader({ title, subtitle, breadcrumb, actions }: { title: string; subtitle?: string; breadcrumb?: BreadcrumbItem[]; actions?: ReactNode }) {
  const { Link } = useSupportConfig();
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
      <span>{SUPPORT_PRIVACY_TEXT}</span>
    </p>
  );
}

export function AvailabilityLine() {
  const availability = useSupportAvailability();
  if (availability.data === undefined) {
    if (!availability.isError) return null;
    return (
      <Alert tone="warning" title="Disponibilité du support inconnue">
        Vous pouvez tout de même écrire : votre demande sera traitée dès que le support la lira.
      </Alert>
    );
  }
  const { online, hoursLabel, responseLabel } = availability.data;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body text-fg-muted" aria-live="polite">
      <Badge tone={online ? 'success' : 'neutral'}>{online ? 'Support en ligne' : 'Support hors ligne'}</Badge>
      <span>
        {hoursLabel} · {responseLabel}
      </span>
    </p>
  );
}
