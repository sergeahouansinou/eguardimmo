import { useId } from 'react';
import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';

export interface TextFieldProps extends Omit<ComponentProps<'input'>, 'placeholder'> {
  label: string;
  placeholder: string;
  hint?: string;
  error?: string;
}

export function TextField({
  label,
  placeholder,
  hint,
  error,
  id,
  type = 'text',
  className,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={inputId} className="text-caption text-fg-muted">
        {label}
      </label>
      <input
        {...props}
        id={inputId}
        type={type}
        placeholder={placeholder}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        className={cx(
          'h-8 w-full rounded-sm border border-line-control bg-surface px-2.5 text-body text-fg placeholder:text-fg-placeholder',
          'focus:border-focus focus:outline-2 focus:-outline-offset-1 focus:outline-focus',
          'read-only:border-line read-only:bg-disabled',
          'disabled:cursor-not-allowed disabled:border-line disabled:bg-disabled disabled:text-fg-disabled',
          'aria-invalid:border-danger-solid',
          className,
        )}
      />
      {hint ? (
        <p id={hintId} className="text-caption font-normal text-fg-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-caption font-normal text-fg-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
