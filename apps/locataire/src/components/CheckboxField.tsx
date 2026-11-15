import { useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';

export interface CheckboxFieldProps extends Omit<ComponentProps<'input'>, 'type' | 'children'> {
  children: ReactNode;
  error?: string;
}

export function CheckboxField({ children, error, id, ...props }: CheckboxFieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const errorId = `${inputId}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="flex cursor-pointer items-start gap-2 text-body text-fg">
        <input
          {...props}
          id={inputId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 size-4 shrink-0 accent-action"
        />
        <span>{children}</span>
      </label>
      {error ? (
        <p id={errorId} className="text-caption text-fg-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
