import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { Icon } from '../Icon/Icon';

export interface StatCardProps extends Omit<ComponentProps<'section'>, 'children'> {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: 'default' | 'danger';
  children?: ReactNode;
}

export function StatCard({
  label,
  value,
  icon,
  tone = 'default',
  className,
  children,
  ...props
}: StatCardProps) {
  return (
    <section
      {...props}
      aria-label={label}
      className={cx(
        'flex min-w-0 flex-col gap-0.5 rounded-lg border border-line bg-surface px-4 py-3',
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-caption text-fg-subtle">
        {icon ? <Icon icon={icon} size={14} /> : null}
        <span>{label}</span>
      </span>
      <span
        className={cx(
          'text-[22px] leading-[30px] font-semibold tabular-nums',
          tone === 'danger' ? 'text-fg-danger' : 'text-fg',
        )}
      >
        {value}
      </span>
      {children}
    </section>
  );
}
