import type { KeyboardEvent } from 'react';
import { cx } from '../../lib/cx';
import { focusRing } from '../../lib/focus';

export interface SegmentedOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  label: string;
  options: readonly SegmentedOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

function moveFocus(event: KeyboardEvent<HTMLButtonElement>) {
  const radios = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? []);
  const index = radios.indexOf(event.currentTarget);
  const targets: Record<string, number> = {
    ArrowRight: (index + 1) % radios.length,
    ArrowDown: (index + 1) % radios.length,
    ArrowLeft: (index - 1 + radios.length) % radios.length,
    ArrowUp: (index - 1 + radios.length) % radios.length,
  };
  const target = targets[event.key];
  if (target === undefined) return;
  event.preventDefault();
  radios[target]?.focus();
  radios[target]?.click();
}

export function SegmentedControl({ label, options, value, onValueChange, className }: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('inline-flex max-w-full flex-wrap gap-0.5 rounded-md bg-muted p-0.5', className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => { onValueChange(option.value); }}
            onKeyDown={moveFocus}
            className={cx(
              'inline-flex h-7 cursor-pointer items-center rounded-sm border px-2.5 text-[13px] leading-5 whitespace-nowrap',
              selected ? 'border-line bg-surface font-semibold text-action-on-subtle' : 'border-transparent font-medium text-fg-subtle',
              focusRing,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
