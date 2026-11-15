import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Icon, cx } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import { Sparkline } from '../charts';
import type { SeriesTone } from '../charts';
import type { Delta, DeltaDirection, DeltaTone } from '../compute/delta';

const toneBadge: Record<DeltaTone, BadgeTone> = { good: 'success', bad: 'warning', neutral: 'neutral' };
const directionIcon = { up: TrendingUp, down: TrendingDown, flat: Minus } as const satisfies Record<DeltaDirection, unknown>;

export function DeltaPill({ delta }: { delta: Delta }) {
  return (
    <Badge tone={toneBadge[delta.tone]}>
      <Icon icon={directionIcon[delta.direction]} size={14} />
      {delta.text}
    </Badge>
  );
}

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  spark?: readonly number[];
  sparkTone?: SeriesTone;
  delta?: Delta | null;
  pill?: ReactNode;
  caption?: ReactNode;
  tone?: 'default' | 'danger';
  className?: string;
}

export function KpiCard({ label, value, spark, sparkTone = 'revenue', delta, pill, caption, tone = 'default', className }: KpiCardProps) {
  return (
    <section
      aria-label={label}
      className={cx('flex min-w-0 flex-col gap-0.5 rounded-lg border border-line bg-surface px-4 py-3', className)}
    >
      <span className="text-caption font-medium whitespace-nowrap text-fg-subtle">{label}</span>
      <div className="flex items-center justify-between gap-2">
        <span className={cx('min-w-0 text-[22px] leading-[30px] font-semibold tabular-nums', tone === 'danger' ? 'text-fg-danger' : 'text-fg')}>
          {value}
        </span>
        {spark && spark.length > 1 ? <Sparkline values={spark} tone={sparkTone} /> : null}
      </div>
      {delta || pill || caption ? (
        <div className="flex items-center gap-1.5">
          {delta ? <DeltaPill delta={delta} /> : null}
          {pill}
          {caption ? <span className="min-w-0 truncate text-caption text-fg-subtle">{caption}</span> : null}
        </div>
      ) : null}
    </section>
  );
}
