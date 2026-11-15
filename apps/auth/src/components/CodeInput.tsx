"use client";

import { cx } from "@eguardimmo/ui";
import { useEffect, useRef } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";

export interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  focusOnMount?: boolean;
  describedBy?: string;
  focusSignal?: number;
}

export function CodeInput({
  value,
  onChange,
  label,
  length = 6,
  invalid = false,
  disabled = false,
  focusOnMount = false,
  describedBy,
  focusSignal = 0,
}: CodeInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (focusOnMount || focusSignal > 0) refs.current[0]?.focus();
  }, [focusOnMount, focusSignal]);

  const focusAt = (index: number) => {
    refs.current[Math.max(0, Math.min(length - 1, index))]?.focus();
  };

  const handleChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, "");
    if (digits === "") {
      onChange(value.slice(0, index));
      return;
    }
    const next = (value.slice(0, index) + digits).slice(0, length);
    onChange(next);
    focusAt(Math.min(index + digits.length, length - 1));
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && value.charAt(index) === "" && index > 0) {
      event.preventDefault();
      onChange(value.slice(0, index - 1));
      focusAt(index - 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusAt(index + 1);
    }
  };

  return (
    <div role="group" aria-label={label} className="grid w-full grid-cols-6 gap-2">
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`${label}, chiffre ${String(index + 1)} sur ${String(length)}`}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          value={value.charAt(index)}
          onChange={(event) => { handleChange(index, event); }}
          onKeyDown={(event) => { handleKeyDown(index, event); }}
          onFocus={(event) => { event.target.select(); }}
          className={cx(
            "h-12 w-full min-w-0 rounded-sm border bg-surface text-center text-[20px] leading-7 font-semibold text-fg",
            "focus:border-focus focus:outline-2 focus:-outline-offset-1 focus:outline-focus",
            "disabled:cursor-not-allowed disabled:bg-disabled disabled:text-fg-disabled",
            invalid ? "border-danger-solid" : "border-line-control",
          )}
        />
      ))}
    </div>
  );
}
