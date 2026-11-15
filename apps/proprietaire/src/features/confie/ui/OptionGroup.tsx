"use client";

import { cx } from "@eguardimmo/ui";
import { useId } from "react";
import type { ReactNode } from "react";

export interface Option<V extends string> {
  value: V;
  label: string;
  description?: string;
}

export interface OptionGroupProps<V extends string> {
  legend: string;
  options: readonly Option<V>[];
  value: V;
  onValueChange: (value: V) => void;
  children?: (value: V) => ReactNode;
}

export function OptionGroup<V extends string>({ legend, options, value, onValueChange, children }: OptionGroupProps<V>) {
  const name = useId();
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <div
            key={option.value}
            className={cx("flex flex-col gap-3 rounded-md border p-3", checked ? "border-action bg-action-subtle" : "border-line bg-surface")}
          >
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => { onValueChange(option.value); }}
                className="mt-0.5 size-4 accent-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
              <span className="flex min-w-0 flex-col">
                <b className="text-body-strong text-fg">{option.label}</b>
                {option.description ? <span className="text-caption text-fg-subtle">{option.description}</span> : null}
              </span>
            </label>
            {checked && children ? children(option.value) : null}
          </div>
        );
      })}
    </fieldset>
  );
}
