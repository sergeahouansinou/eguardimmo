import { useId } from 'react';
import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';

export interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type' | 'children'> {
  label: string;
  hideLabel?: boolean;
  touch?: boolean;
}

export function Checkbox({ label, hideLabel = false, touch = false, id, className, ...props }: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <span className="relative inline-flex items-center gap-2">
      <input
        {...props}
        id={inputId}
        type="checkbox"
        className={cx(
          'peer size-4 shrink-0 cursor-pointer rounded-xs border border-line-control accent-action',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          'disabled:cursor-not-allowed',
          className,
        )}
      />
      <label
        htmlFor={inputId}
        className={cx(
          hideLabel
            ? 'absolute -inset-1 cursor-pointer overflow-hidden leading-none [font-size:0] peer-disabled:cursor-not-allowed'
            : cx(
                '-my-0.5 inline-flex items-center text-body text-fg peer-disabled:cursor-not-allowed',
                touch ? 'min-h-11 cursor-pointer' : 'min-h-6',
              ),
        )}
      >
        {label}
      </label>
    </span>
  );
}
