import { useId } from 'react';
import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';

export interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type' | 'children'> {
  label: string;
  hideLabel?: boolean;
}

export function Checkbox({ label, hideLabel = false, id, className, ...props }: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <span className="inline-flex items-center gap-2">
      <input
        {...props}
        id={inputId}
        type="checkbox"
        className={cx(
          'size-4 shrink-0 cursor-pointer rounded-xs border border-line-control accent-action',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          'disabled:cursor-not-allowed',
          className,
        )}
      />
      <label htmlFor={inputId} className={cx('text-body text-fg', hideLabel && 'sr-only')}>
        {label}
      </label>
    </span>
  );
}
