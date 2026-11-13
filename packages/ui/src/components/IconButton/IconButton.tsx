import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';
import { focusRing } from '../../lib/focus';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';

export type IconButtonVariant = 'ghost' | 'secondary' | 'danger';
export type IconButtonSize = 'xs' | 'sm';

const variantClasses: Record<IconButtonVariant, string> = {
  ghost: 'border-transparent text-fg-muted hover:bg-muted',
  secondary: 'border-line bg-surface text-fg-muted hover:bg-muted',
  danger: 'border-transparent text-fg-danger hover:bg-danger',
};

const sizeClasses: Record<IconButtonSize, string> = {
  xs: 'size-6',
  sm: 'size-7',
};

export interface IconButtonProps
  extends Omit<ComponentProps<'button'>, 'children' | 'title' | 'aria-label'> {
  label: string;
  icon: LucideIcon;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'sm',
  type = 'button',
  className,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip content={label}>
      <button
        {...props}
        type={type}
        aria-label={label}
        className={cx(
          'inline-flex shrink-0 items-center justify-center rounded-sm border',
          'disabled:cursor-not-allowed disabled:text-fg-disabled disabled:hover:bg-transparent',
          focusRing,
          sizeClasses[size],
          variantClasses[variant],
          className,
        )}
      >
        <Icon icon={icon} size={16} />
      </button>
    </Tooltip>
  );
}
