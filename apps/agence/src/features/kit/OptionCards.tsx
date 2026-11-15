import { cx } from "@eguardimmo/ui";
import { useId } from "react";
import type { ReactNode } from "react";

export interface Option {
  value: string;
  label: string;
  description?: string;
  trailing?: ReactNode;
  disabled?: boolean;
}

interface BaseProps {
  legend: string;
  options: readonly Option[];
  hideLegend?: boolean;
  error?: string;
  className?: string;
}

export interface RadioCardsProps extends BaseProps {
  value: string;
  onValueChange: (value: string) => void;
}

export interface CheckCardsProps extends BaseProps {
  values: readonly string[];
  onValuesChange: (values: readonly string[]) => void;
}

const optionClass =
  "flex cursor-pointer items-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2.5 has-checked:border-action has-checked:bg-action-subtle has-focus-visible:outline-2 has-focus-visible:outline-focus has-disabled:cursor-not-allowed has-disabled:opacity-60";

function OptionBody({ option }: { option: Option }) {
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-strong text-fg">{option.label}</span>
        {option.description ? <span className="text-caption text-fg-subtle">{option.description}</span> : null}
      </span>
      {option.trailing ? <span className="text-body-strong text-action-on-subtle tabular-nums">{option.trailing}</span> : null}
    </>
  );
}

function Frame({ legend, hideLegend, error, className, children }: BaseProps & { children: ReactNode }) {
  return (
    <fieldset className={cx("flex min-w-0 flex-col gap-2", className)}>
      <legend className={cx("mb-1 text-caption text-fg-muted", hideLegend && "sr-only")}>{legend}</legend>
      {children}
      {error ? <p className="text-caption text-fg-danger">{error}</p> : null}
    </fieldset>
  );
}

export function RadioCards({ value, onValueChange, ...base }: RadioCardsProps) {
  const name = useId();
  return (
    <Frame {...base}>
      {base.options.map((option) => (
        <label key={option.value} className={optionClass}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => {
              onValueChange(option.value);
            }}
            className="size-4 shrink-0 cursor-pointer accent-action"
          />
          <OptionBody option={option} />
        </label>
      ))}
    </Frame>
  );
}

export function CheckCards({ values, onValuesChange, ...base }: CheckCardsProps) {
  return (
    <Frame {...base}>
      {base.options.map((option) => {
        const checked = values.includes(option.value);
        return (
          <label key={option.value} className={optionClass}>
            <input
              type="checkbox"
              value={option.value}
              checked={checked}
              disabled={option.disabled}
              onChange={() => {
                onValuesChange(checked ? values.filter((item) => item !== option.value) : [...values, option.value]);
              }}
              className="size-4 shrink-0 cursor-pointer accent-action"
            />
            <OptionBody option={option} />
          </label>
        );
      })}
    </Frame>
  );
}
