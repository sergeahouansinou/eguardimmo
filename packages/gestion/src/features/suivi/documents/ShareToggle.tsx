'use client';

import { cx } from '@eguardimmo/ui';

export function ShareToggle({
  checked,
  label,
  onCheckedChange,
  disabled = false,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
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
        checked ? 'bg-action' : 'bg-line-strong',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
      )}
    >
      <span aria-hidden="true" className={cx('absolute top-0.5 size-3.5 rounded-full bg-surface transition-[left]', checked ? 'left-4' : 'left-0.5')} />
    </button>
  );
}
