"use client";

import { cx } from "@eguardimmo/ui";

export interface ToggleProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, checked, onCheckedChange, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => { onCheckedChange(!checked); }}
      className={cx(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-action" : "bg-line-control",
      )}
    >
      <span
        aria-hidden="true"
        className={cx("inline-block size-4 rounded-full bg-surface transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")}
      />
    </button>
  );
}
