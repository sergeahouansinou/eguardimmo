import { Button, Card, CardHeader, CardTitle, Icon, cx } from '@eguardimmo/ui';
import { toneTile } from '@eguardimmo/shell';
import type { Tone } from '@eguardimmo/shell';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

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
    <Card role="region" aria-labelledby={id} className={cx('px-4 py-3', className)}>
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

export function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button variant="link" size="sm" asChild>
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export function KeyValueList({
  items,
  labelWidth = '6rem',
  className,
}: {
  items: readonly { label: string; value: ReactNode }[];
  labelWidth?: string;
  className?: string;
}) {
  return (
    <dl
      className={cx('grid gap-x-3 gap-y-2 text-body max-sm:grid-cols-1', className)}
      style={{ gridTemplateColumns: `minmax(0, ${labelWidth}) minmax(0, 1fr)` }}
    >
      {items.map((item) => (
        <div key={item.label} className="contents max-sm:flex max-sm:flex-col">
          <dt className="text-fg-subtle">{item.label}</dt>
          <dd className="min-w-0 break-words text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function IconTile({ icon, tone = 'info' }: { icon: LucideIcon; tone?: Tone }) {
  return (
    <span className={cx('inline-flex size-7 shrink-0 items-center justify-center rounded-md', toneTile[tone])}>
      <Icon icon={icon} />
    </span>
  );
}

export function ListRow({
  icon,
  tone,
  leading,
  title,
  href,
  detail,
  trailing,
}: {
  icon?: LucideIcon;
  tone?: Tone;
  leading?: ReactNode;
  title: ReactNode;
  href?: string;
  detail?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <li className="flex min-h-12 items-center gap-2.5 border-t border-line py-2 first:border-t-0">
      {leading ?? (icon ? <IconTile icon={icon} tone={tone} /> : null)}
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="truncate text-body-strong text-fg">
          {href ? (
            <Link href={href} className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
              {title}
            </Link>
          ) : (
            title
          )}
        </b>
        {detail ? <span className="truncate text-caption text-fg-subtle">{detail}</span> : null}
      </span>
      {trailing}
    </li>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="py-3 text-body text-fg-subtle">{children}</p>;
}

export function TotalsList({ items }: { items: readonly { label: string; value: ReactNode; strong?: boolean }[] }) {
  return (
    <dl className="flex flex-col text-body">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-3 border-t border-line py-2 first:border-t-0">
          <dt className="text-fg-muted">{item.label}</dt>
          <dd className={cx('text-right tabular-nums', item.strong ? 'font-semibold text-fg' : 'text-fg')}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
