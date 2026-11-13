import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';

export type AvatarSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'size-6 text-[10px] leading-3',
  md: 'size-8 text-caption',
  lg: 'size-10 text-body',
};

export interface AvatarProps extends Omit<ComponentProps<'span'>, 'children'> {
  initials: string;
  size?: AvatarSize;
  label?: string;
}

export function Avatar({ initials, size = 'sm', label, className, ...props }: AvatarProps) {
  return (
    <span
      {...props}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-action-subtle font-semibold text-action-on-subtle',
        sizeClasses[size],
        className,
      )}
    >
      {initials.slice(0, 2).toUpperCase()}
    </span>
  );
}
