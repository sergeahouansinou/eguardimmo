import { useId } from 'react';
import type { ComponentProps } from 'react';
import { cx } from '../../lib/cx';

export interface TextareaProps extends Omit<ComponentProps<'textarea'>, 'placeholder'> {
  label: string;
  placeholder: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
}

export function Textarea({
  label,
  placeholder,
  hint,
  error,
  hideLabel = false,
  id,
  rows = 4,
  className,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={fieldId} className={cx('text-caption text-fg-muted', hideLabel && 'sr-only')}>
        {label}
      </label>
      <textarea
        {...props}
        id={fieldId}
        rows={rows}
        placeholder={placeholder}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        className={cx(
          'w-full resize-y rounded-sm border border-line-control bg-surface px-2.5 py-1.5 text-body text-fg placeholder:text-fg-placeholder',
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
