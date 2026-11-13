import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-fg-muted',
  info: 'bg-info text-info-fg',
  success: 'bg-success text-success-fg',
  warning: 'bg-warning text-warning-fg',
  danger: 'bg-danger text-danger-fg',
};

export interface BadgeProps extends ComponentProps<'span'> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cx(
        'inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-caption whitespace-nowrap',
        toneClasses[tone],
        className,
      )}
    />
  );
}
