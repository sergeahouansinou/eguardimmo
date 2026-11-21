import { useId } from 'react';
import { cx } from '../../lib/cx';
import { TextField } from '../TextField/TextField';

export interface DateRangeFieldProps {
  legend: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromLabel?: string;
  toLabel?: string;
  hint?: string;
  error?: string;
  className?: string;
}

export function DateRangeField({
  legend,
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel = 'Du',
  toLabel = 'Au',
  hint,
  error,
  className,
}: DateRangeFieldProps) {
  const messageId = useId();
  const describedBy = error ? messageId : hint ? messageId : undefined;
  return (
    <fieldset className={cx('flex min-w-0 flex-col gap-1', className)} aria-describedby={describedBy}>
      <legend className="text-caption text-fg-muted">{legend}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <TextField
          label={fromLabel}
          placeholder="jj/mm/aaaa"
          type="date"
          value={from}
          onChange={(event) => {
            onFromChange(event.target.value);
          }}
        />
        <TextField
          label={toLabel}
          placeholder="jj/mm/aaaa"
          type="date"
          value={to}
          onChange={(event) => {
            onToChange(event.target.value);
          }}
        />
      </div>
      {error ? (
        <p id={messageId} role="alert" className="text-caption font-normal text-fg-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-caption font-normal text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}
