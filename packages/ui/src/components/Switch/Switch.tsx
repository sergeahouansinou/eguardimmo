import { useId } from 'react';
import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';
import { focusRing } from '../../lib/focus';

export interface SwitchProps extends Omit<ComponentProps<'button'>, 'role' | 'onChange' | 'children'> {
  label: string;
  hideLabel?: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Switch({ label, hideLabel = false, checked, onCheckedChange, id, className, disabled, ...props }: SwitchProps) {
  const generatedId = useId();
  const switchId = id ?? generatedId;
  return (
    <span className="flex items-center justify-between gap-3">
      <label htmlFor={switchId} className={cx('text-body text-fg', hideLabel && 'sr-only')}>
        {label}
      </label>
      <button
        {...props}
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => { onCheckedChange(!checked); }}
        className={cx(
          'relative h-[18px] w-8 shrink-0 cursor-pointer rounded-full transition-colors',
          checked ? 'bg-action' : 'bg-line-toggle',
          'disabled:cursor-not-allowed disabled:bg-disabled',
          focusRing,
          className,
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            'absolute top-0.5 size-3.5 rounded-full bg-surface transition-[left]',
            checked ? 'left-4' : 'left-0.5',
          )}
        />
      </button>
    </span>
  );
}
