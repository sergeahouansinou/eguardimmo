import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';

export interface ProgressBarProps extends Omit<ComponentProps<'div'>, 'children' | 'role'> {
  value: number;
  label: string;
}

export function ProgressBar({ value, label, className, ...props }: ProgressBarProps) {
  const bounded = Math.min(100, Math.max(0, value));
  return (
    <div
      {...props}
      role="img"
      aria-label={label}
      className={cx('h-1 overflow-hidden rounded-full bg-muted', className)}
    >
      <span className="block h-full bg-action" style={{ width: `${String(bounded)}%` }} />
    </div>
  );
}
