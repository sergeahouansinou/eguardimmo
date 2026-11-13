import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';

export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      {...props}
      className={cx(
        'inline-flex items-center rounded-xs border border-line px-1 font-sans text-caption text-fg-subtle',
        className,
      )}
    />
  );
}
