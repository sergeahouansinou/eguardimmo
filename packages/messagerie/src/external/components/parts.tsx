'use client';

import { Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Breadcrumb, Icon } from '@eguardimmo/ui';
import type { BreadcrumbItem } from '@eguardimmo/ui';
import { NOT_A_NOTICE_TEXT } from '../copy';
import { useExternalConfig } from '../context';

export function ExternalHeader({ title, subtitle, breadcrumb, actions }: { title: string; subtitle?: string; breadcrumb?: BreadcrumbItem[]; actions?: ReactNode }) {
  const { Link } = useExternalConfig();
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

export function NoticeNotAFormalAct() {
  return (
    <p className="flex items-start gap-1.5 text-caption text-fg-muted">
      <Icon icon={Info} size={14} className="mt-0.5 shrink-0" />
      <span>{NOT_A_NOTICE_TEXT}</span>
    </p>
  );
}

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()); }, intervalMs);
    return () => { clearInterval(timer); };
  }, [intervalMs]);
  return now;
}
