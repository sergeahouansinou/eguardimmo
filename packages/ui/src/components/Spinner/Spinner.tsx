import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';

export type SpinnerSize = 16 | 20 | 32;

const sizeClasses: Record<SpinnerSize, string> = {
  16: 'size-4',
  20: 'size-5',
  32: 'size-8',
};

export type SpinnerTone = 'default' | 'current';

const toneClasses: Record<SpinnerTone, string> = {
  default: 'border-line border-t-action',
  current: 'border-current/25 border-t-current',
};

export interface SpinnerProps extends Omit<ComponentProps<'span'>, 'children'> {
  size?: SpinnerSize;
  label?: string;
  decorative?: boolean;
  tone?: SpinnerTone;
}

export function Spinner({
  size = 16,
  label = 'Chargement',
  decorative = false,
  tone = 'default',
  className,
  ...props
}: SpinnerProps) {
  return (
    <span
      {...props}
      role={decorative ? undefined : 'status'}
      aria-hidden={decorative ? true : undefined}
      className={cx('inline-flex shrink-0', className)}
    >
      <span
        aria-hidden="true"
        className={cx(
          'inline-block animate-spin rounded-full border-2 motion-reduce:animate-none',
          toneClasses[tone],
          sizeClasses[size],
        )}
      />
      {decorative ? null : <span className="sr-only">{label}</span>}
    </span>
  );
}
