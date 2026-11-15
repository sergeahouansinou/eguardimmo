import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';
import { focusRing } from '../../lib/focus';

export interface ChipProps extends Omit<ComponentProps<'button'>, 'aria-pressed'> {
  pressed: boolean;
}

export function Chip({ pressed, className, type = 'button', ...props }: ChipProps) {
  return (
    <button
      {...props}
      type={type}
      aria-pressed={pressed}
      className={cx(
        'inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-caption whitespace-nowrap',
        pressed
          ? 'border-action bg-action-subtle font-semibold text-action-on-subtle'
          : 'border-line bg-surface font-medium text-fg-muted hover:bg-muted',
        'disabled:cursor-not-allowed disabled:text-fg-disabled',
        focusRing,
        className,
      )}
    />
  );
}
