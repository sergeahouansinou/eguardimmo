'use client';

import { Slot, Slottable } from '@radix-ui/react-slot';
import type { ComponentProps, MouseEvent } from 'react';
import { cx } from '../../lib/cx';
import { focusRing } from '../../lib/focus';
import { Spinner } from '../Spinner/Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-action text-on-action hover:bg-action-hover active:bg-action-pressed disabled:bg-disabled disabled:text-fg-disabled',
  accent:
    'border-transparent bg-accent text-on-accent hover:opacity-90 active:opacity-80 disabled:bg-disabled disabled:text-fg-disabled',
  secondary:
    'border-line bg-surface text-fg hover:bg-muted disabled:bg-disabled disabled:text-fg-disabled',
  ghost: 'border-transparent text-fg-muted hover:bg-muted disabled:text-fg-disabled disabled:hover:bg-transparent',
  danger:
    'border-transparent bg-danger-solid text-on-action hover:bg-danger-solid-hover disabled:bg-disabled disabled:text-fg-disabled',
  link: 'border-transparent px-0.5 font-medium text-action-on-subtle underline decoration-1 underline-offset-3 disabled:text-fg-disabled',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 rounded-sm px-2.5 text-caption font-semibold',
  md: 'h-8 rounded-md px-3 text-body font-semibold',
  lg: 'h-10 rounded-md px-4 text-[16px] leading-6 font-semibold',
};

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  asChild?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  asChild = false,
  type = 'button',
  disabled,
  onClick,
  className,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  const blocked = loading || (asChild && disabled === true);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (blocked) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <Comp
      {...props}
      type={asChild ? undefined : type}
      disabled={asChild ? undefined : disabled}
      aria-disabled={blocked ? true : undefined}
      aria-busy={loading ? true : undefined}
      onClick={handleClick}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 border whitespace-nowrap',
        'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-busy:cursor-progress',
        focusRing,
        sizeClasses[size],
        variantClasses[variant],
        variant !== 'link' && 'disabled:border-line',
        className,
      )}
    >
      {loading ? <Spinner decorative tone="current" /> : null}
      <Slottable>{children}</Slottable>
    </Comp>
  );
}
