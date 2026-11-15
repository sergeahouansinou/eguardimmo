'use client';

import { useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from '@eguardimmo/ui';

export interface RadioCardOption {
  value: string;
  label: string;
  description?: string;
  trailing?: ReactNode;
}

export interface RadioCardsProps {
  labelledBy: string;
  options: readonly RadioCardOption[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function RadioCards({ labelledBy, options, value, onValueChange, disabled = false }: RadioCardsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = options.length - 1;
    const targets: Record<string, number> = {
      ArrowDown: index === last ? 0 : index + 1,
      ArrowRight: index === last ? 0 : index + 1,
      ArrowUp: index === 0 ? last : index - 1,
      ArrowLeft: index === 0 ? last : index - 1,
    };
    const target = targets[event.key];
    const option = target === undefined ? undefined : options[target];
    if (target === undefined || !option) return;
    event.preventDefault();
    refs.current[target]?.focus();
    onValueChange(option.value);
  };

  const selectedIndex = options.findIndex((option) => option.value === value);
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-col gap-2">
      {options.map((option, index) => {
        const checked = option.value === value;
        const focusable = checked || (selectedIndex === -1 && index === 0);
        return (
          <button
            key={option.value}
            ref={(node) => { refs.current[index] = node; }}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            tabIndex={focusable ? 0 : -1}
            onClick={() => { onValueChange(option.value); }}
            onKeyDown={(event) => { move(event, index); }}
            className={cx(
              'flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              'disabled:cursor-not-allowed disabled:opacity-60',
              checked ? 'border-action bg-action-subtle' : 'border-line bg-surface hover:bg-muted',
            )}
          >
            <span
              aria-hidden="true"
              className={cx(
                'flex size-4 shrink-0 items-center justify-center rounded-full border',
                checked ? 'border-action' : 'border-line-control',
              )}
            >
              {checked ? <span className="size-2 rounded-full bg-action" /> : null}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body-strong text-fg">{option.label}</span>
              {option.description ? <span className="text-caption text-fg-subtle">{option.description}</span> : null}
            </span>
            {option.trailing}
          </button>
        );
      })}
    </div>
  );
}
