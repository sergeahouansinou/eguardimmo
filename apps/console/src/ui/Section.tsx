import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardHeader, CardTitle, Icon, ProgressBar, cx } from '@eguardimmo/ui';

export function Section({
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
      <CardHeader className="min-h-7 flex-wrap">
        <CardTitle as="h2" id={id}>
          {title}
        </CardTitle>
        {aside}
      </CardHeader>
      {children}
    </Card>
  );
}

export function ListRow({
  icon,
  tone = 'default',
  title,
  detail,
  trailing,
}: {
  icon?: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'neutral';
  title: ReactNode;
  detail?: ReactNode;
  trailing?: ReactNode;
}) {
  const toneClass = {
    default: 'bg-action-subtle text-action-on-subtle',
    success: 'bg-success text-success-fg',
    warning: 'bg-warning text-warning-fg',
    danger: 'bg-danger text-danger-fg',
    neutral: 'bg-muted text-fg-subtle',
  }[tone];
  return (
    <li className="flex min-h-12 items-center gap-2.5 border-t border-line py-2 first:border-t-0">
      {icon ? (
        <span className={cx('flex size-7 shrink-0 items-center justify-center rounded-md', toneClass)}>
          <Icon icon={icon} size={16} />
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-strong break-words text-fg">{title}</span>
        {detail ? <span className="text-caption break-words text-fg-subtle">{detail}</span> : null}
      </span>
      {trailing ? <span className="flex shrink-0 items-center gap-2">{trailing}</span> : null}
    </li>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="py-3 text-body text-fg-subtle">{children}</p>;
}

export function KeyValueList({ items, labelWidth = 'sm:grid-cols-[140px_minmax(0,1fr)]' }: {
  items: readonly { label: string; value: ReactNode }[];
  labelWidth?: string;
}) {
  return (
    <dl className={cx('grid grid-cols-1 gap-x-4 gap-y-1 text-body', labelWidth)}>
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="pt-1.5 text-caption text-fg-subtle sm:pt-0.5">{item.label}</dt>
          <dd className="min-w-0 break-words text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function UsageBar({ label, value, max, text }: { label: string; value: number; max: number | null; text: string }) {
  const percent = max === null || max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 sm:grid-cols-[104px_minmax(0,1fr)_auto]">
      <span className="text-body text-fg-muted">{label}</span>
      {max === null ? <span aria-hidden="true" /> : <ProgressBar value={percent} label={`${label} : ${text}`} className="h-2" />}
      <b className="col-span-2 text-right text-body-strong tabular-nums sm:col-span-1">{text}</b>
    </div>
  );
}
