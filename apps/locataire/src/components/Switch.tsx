import { cx } from '@eguardimmo/ui';
import { focusRing } from './focus';

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
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
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors',
        checked ? 'bg-action' : 'bg-line-toggle',
        'disabled:cursor-not-allowed disabled:opacity-60',
        focusRing,
      )}
    >
      <span
        aria-hidden="true"
        className={cx('size-4 rounded-full bg-surface transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')}
      />
    </button>
  );
}
