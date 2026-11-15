'use client';

import { cx } from '@eguardimmo/ui';

export interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onCheckedChange, label, disabled = false, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => { onCheckedChange(!checked); }}
      className={cx(
        'relative inline-block h-[18px] w-8 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        checked ? 'bg-action' : 'bg-line-toggle',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx('absolute top-0.5 size-3.5 rounded-full bg-surface transition-[left]', checked ? 'left-4' : 'left-0.5')}
      />
    </button>
  );
}
