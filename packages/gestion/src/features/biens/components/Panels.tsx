'use client';

import { Badge, Button, Card, CardHeader, CardTitle, Icon, cx } from '@eguardimmo/ui';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useBiensEnvironment } from '../environment';
import type { Badge as BadgeData, FactRow } from '../schemas/common';

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle as="h2">{title}</CardTitle>
        {action}
      </CardHeader>
      {children}
    </Card>
  );
}

export function PillBadge({ badge }: { badge: BadgeData }) {
  return <Badge tone={badge.tone}>{badge.label}</Badge>;
}

function SecretValue({ value }: { value: string }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="tabular-nums">{shown ? value : '••••'}</span>
      <Button variant="link" size="sm" onClick={() => { setShown((current) => !current); }}>
        <Icon icon={shown ? EyeOff : Eye} size={14} />
        {shown ? 'Masquer' : 'Afficher'}
      </Button>
    </span>
  );
}

export function FactList({ rows, className, single = false }: { rows: readonly FactRow[]; className?: string; single?: boolean }) {
  return (
    <dl className={cx('grid grid-cols-1 gap-x-6', !single && 'sm:grid-cols-2', className)}>
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-b-0">
          <dt className="text-caption text-fg-subtle">{row.label}</dt>
          <dd className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 text-right text-body text-fg">
            {row.secret ? <SecretValue value={row.value} /> : <span>{row.value}</span>}
            {row.badge ? <PillBadge badge={row.badge} /> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export interface EntryItem {
  id: string;
  title: ReactNode;
  detail?: ReactNode;
  badge?: BadgeData | null;
  href?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function EntryList({ items, label, empty }: { items: readonly EntryItem[]; label: string; empty?: ReactNode }) {
  const { Link } = useBiensEnvironment();
  if (items.length === 0) return <p className="text-body text-fg-muted">{empty ?? 'Rien à afficher pour le moment.'}</p>;
  return (
    <ul aria-label={label} className="flex flex-col">
      {items.map((item) => {
        const body = (
          <>
            {item.leading}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-medium text-fg">{item.title}</span>
              {item.detail ? <span className="block text-caption text-fg-subtle">{item.detail}</span> : null}
            </span>
            {item.trailing}
            {item.badge ? <PillBadge badge={item.badge} /> : null}
          </>
        );
        return (
          <li key={item.id} className="border-b border-line last:border-b-0">
            {item.href ? (
              <Link href={item.href} className="flex items-center gap-2 py-2 hover:bg-muted">
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-2 py-2">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function Caption({ children }: { children: ReactNode }) {
  return <span className="block text-caption text-fg-subtle">{children}</span>;
}
