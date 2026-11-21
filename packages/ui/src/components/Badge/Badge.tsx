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
  wrap?: boolean;
}

export function Badge({ tone = 'neutral', wrap = false, className, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-1.5 text-caption',
        wrap ? 'max-w-full min-h-5 py-0.5 [overflow-wrap:anywhere]' : 'h-5 whitespace-nowrap',
        toneClasses[tone],
        className,
      )}
    />
  );
}
