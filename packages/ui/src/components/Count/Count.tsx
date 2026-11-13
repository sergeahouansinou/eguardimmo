import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';

export type CountTone = 'neutral' | 'active' | 'accent';

const toneClasses: Record<CountTone, string> = {
  neutral: 'bg-muted text-fg-muted',
  active: 'bg-action text-on-action',
  accent: 'bg-accent text-on-accent',
};

export interface CountProps extends Omit<ComponentProps<'span'>, 'children'> {
  value: number;
  tone?: CountTone;
}

export function Count({ value, tone = 'neutral', className, ...props }: CountProps) {
  return (
    <span
      {...props}
      className={cx(
        'inline-flex h-[18px] min-w-5 items-center justify-center rounded-full px-1.5 text-caption font-semibold tabular-nums',
        toneClasses[tone],
        className,
      )}
    >
      {value}
    </span>
  );
}
