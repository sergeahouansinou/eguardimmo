'use client';

import { useId } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from '@eguardimmo/ui';

const ring = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onCheckedChange, label, hint, disabled = false, className }: SwitchProps) {
  const labelId = useId();
  return (
    <div className={cx('flex items-start gap-2.5', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        disabled={disabled}
        onClick={() => { onCheckedChange(!checked); }}
        className={cx(
          'relative mt-0.5 inline-block h-[18px] w-8 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-action' : 'bg-line-strong',
          ring,
        )}
      >
        <span
          aria-hidden="true"
          className={cx('absolute top-0.5 size-3.5 rounded-full bg-surface transition-[left]', checked ? 'left-4' : 'left-0.5')}
        />
      </button>
      <span className="flex min-w-0 flex-col">
        <span id={labelId} className="text-body text-fg">
          {label}
        </span>
        {hint ? <span className="text-caption text-fg-subtle">{hint}</span> : null}
      </span>
    </div>
  );
}

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  hideLabel?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ checked, onCheckedChange, label, hideLabel = false, disabled = false, className }: CheckboxProps) {
  return (
    <label className={cx('inline-flex cursor-pointer items-center gap-2 text-body text-fg', disabled && 'cursor-not-allowed opacity-50', className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => { onCheckedChange(event.target.checked); }}
        className={cx('size-4 accent-action', ring)}
      />
      <span className={cx(hideLabel && 'sr-only')}>{label}</span>
    </label>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string>({ label, options, value, onValueChange, className }: SegmentedProps<T>) {
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = options[(index + delta + options.length) % options.length];
    if (!next) return;
    onValueChange(next.value);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons?.[(index + delta + options.length) % options.length]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex flex-wrap gap-0.5 rounded-md bg-muted p-0.5', className)}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => { onValueChange(option.value); }}
            onKeyDown={(event) => { move(event, index); }}
            className={cx(
              'inline-flex h-7 items-center rounded-sm border px-2.5 text-body whitespace-nowrap',
              selected ? 'border-line bg-surface font-semibold text-action-on-subtle' : 'border-transparent text-fg-subtle hover:text-fg',
              ring,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export interface FilterChipProps {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: ReactNode;
  swatch?: string;
}

export function FilterChip({ pressed, onPressedChange, children, swatch }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => { onPressedChange(!pressed); }}
      className={cx(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-caption font-medium whitespace-nowrap',
        pressed ? 'border-action bg-action-subtle text-action-on-subtle' : 'border-line bg-surface text-fg-muted hover:bg-muted',
        ring,
      )}
    >
      {swatch ? <i aria-hidden="true" className={cx('size-2 rounded-full', swatch)} /> : null}
      {children}
    </button>
  );
}
