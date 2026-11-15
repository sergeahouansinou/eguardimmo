import { Icon, cx } from '@eguardimmo/ui';
import type { LucideIcon } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';

export interface RadioCardOption<Value extends string> {
  value: Value;
  label: string;
  detail: string;
  icon?: LucideIcon;
  disabled?: boolean;
  trailing?: ReactNode;
}

export function RadioCards<Value extends string>({
  legend,
  options,
  value,
  onValueChange,
  error,
}: {
  legend: string;
  options: readonly RadioCardOption<Value>[];
  value: Value | '';
  onValueChange: (value: Value) => void;
  error?: string;
}) {
  const name = useId();
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className={cx(
              'flex cursor-pointer items-center gap-2.5 rounded-md border bg-surface px-3 py-2.5 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
              selected ? 'border-action bg-action-subtle' : 'border-line',
              option.disabled && 'cursor-not-allowed bg-disabled text-fg-disabled',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              disabled={option.disabled}
              onChange={() => { onValueChange(option.value); }}
              className="size-4 shrink-0 accent-action"
            />
            {option.icon ? <Icon icon={option.icon} className="text-action-on-subtle" /> : null}
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="text-body-strong text-fg">{option.label}</b>
              <span className="text-caption text-fg-subtle">{option.detail}</span>
            </span>
            {option.trailing}
          </label>
        );
      })}
      {error ? <p className="text-caption text-fg-danger">{error}</p> : null}
    </fieldset>
  );
}
