import { Badge, Icon, cx } from '@eguardimmo/ui';
import { toneBadge, toneTile } from '@eguardimmo/shell';
import type { Tone } from '@eguardimmo/shell';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function ItemRow({
  icon,
  tone = 'neutral',
  title,
  detail,
  badge,
  trailing,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: ReactNode;
  detail?: ReactNode;
  badge?: { label: string; tone: Tone };
  trailing?: ReactNode;
}) {
  return (
    <li className="flex min-h-12 items-center gap-2.5 border-t border-line py-1.5 first:border-t-0">
      <span className={cx('inline-flex size-7 shrink-0 items-center justify-center rounded-md', toneTile[tone])}>
        <Icon icon={icon} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="truncate text-body-strong text-fg">{title}</b>
        {detail ? <span className="truncate text-caption text-fg-subtle">{detail}</span> : null}
      </span>
      {badge ? <Badge tone={toneBadge[badge.tone]}>{badge.label}</Badge> : null}
      {trailing}
    </li>
  );
}

export function SectionCard({
  id,
  title,
  aside,
  children,
}: {
  id: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-block-title text-fg">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
