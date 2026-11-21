import { useId } from 'react';
import { cx } from '../../lib/cx';

export interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  label: string;
  options: readonly RadioOption[];
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  className?: string;
}

export function RadioGroup({ label, options, value, onValueChange, error, className }: RadioGroupProps) {
  const name = useId();
  return (
    <fieldset className={cx('flex min-w-0 flex-col gap-1.5 border-0 p-0', className)}>
      <legend className="mb-1.5 p-0 text-caption text-fg-muted">{label}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {options.map((option) => {
          const id = `${name}-${option.value}`;
          return (
            <span key={option.value} className="inline-flex min-h-6 items-center gap-2">
              <input
                id={id}
                type="radio"
                name={name}
                value={option.value}
                checked={option.value === value}
                disabled={option.disabled}
                onChange={() => { onValueChange(option.value); }}
                className="size-4 cursor-pointer accent-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed"
              />
              <label htmlFor={id} className="inline-flex min-h-6 cursor-pointer items-center text-body text-fg">
                {option.label}
              </label>
            </span>
          );
        })}
      </div>
      {error ? <p className="text-caption text-fg-danger">{error}</p> : null}
    </fieldset>
  );
}
