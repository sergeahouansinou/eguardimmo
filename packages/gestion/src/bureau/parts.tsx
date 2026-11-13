import type { ReactNode } from 'react';
import { Button, Card, CardHeader, CardTitle, cx } from '@eguardimmo/ui';
import type { LinkComponent } from '@eguardimmo/ui';

export function SectionCard({
  id,
  title,
  aside,
  className,
  children,
}: {
  id: string;
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card aria-labelledby={id} role="region" className={cx('px-4 py-3', className)}>
      <CardHeader className="flex-wrap">
        <CardTitle as="h2" id={id}>
          {title}
        </CardTitle>
        {aside}
      </CardHeader>
      {children}
    </Card>
  );
}

export function CardLink({ Link, href, children }: { Link: LinkComponent; href: string; children: ReactNode }) {
  return (
    <Button variant="link" size="sm" asChild>
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export function TimelineRow({
  lead,
  title,
  detail,
  trailing,
}: {
  lead: string;
  title: string;
  detail: string;
  trailing?: ReactNode;
}) {
  return (
    <li className="flex min-h-11 items-center gap-2.5 border-t border-line first:border-t-0">
      <span className="w-11 shrink-0 text-caption font-semibold text-fg-muted tabular-nums">{lead}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="truncate text-body-strong text-fg">{title}</b>
        <span className="truncate text-caption text-fg-subtle">{detail}</span>
      </span>
      {trailing}
    </li>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="py-3 text-body text-fg-subtle">{children}</p>;
}
