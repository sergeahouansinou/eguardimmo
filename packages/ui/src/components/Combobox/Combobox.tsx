'use client';
/* eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-element-to-interactive-role, jsx-a11y/click-events-have-key-events -- Motif combobox ARIA : le focus reste sur le champ, le clavier est géré par lui via aria-activedescendant. */

import { useId, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { cx } from '../../lib/cx';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
}

export interface ComboboxProps {
  label: string;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly ComboboxOption[];
  onSelect: (option: ComboboxOption) => void;
  minChars?: number;
  loading?: boolean;
  emptyLabel?: string;
  hideLabel?: boolean;
  id?: string;
  className?: string;
  inputClassName?: string;
}

export function Combobox({
  label,
  placeholder,
  value,
  onValueChange,
  options,
  onSelect,
  minChars = 2,
  loading = false,
  emptyLabel = 'Aucun résultat',
  hideLabel = false,
  id,
  className,
  inputClassName,
}: ComboboxProps) {
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const listId = `${baseId}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const searching = value.trim().length >= minChars;
  const expanded = open && searching;
  const optionId = (index: number) => `${baseId}-option-${String(index)}`;
  const activeOption = active >= 0 ? options[active] : undefined;

  const choose = (option: ComboboxOption) => {
    onSelect(option);
    setOpen(false);
    setActive(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      if (expanded) event.preventDefault();
      setOpen(false);
      setActive(-1);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (options.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (current + step + options.length) % options.length);
      return;
    }
    if (event.key === 'Enter' && expanded && activeOption) {
      event.preventDefault();
      choose(activeOption);
    }
  };

  return (
    <div
      className={cx('relative flex min-w-0 flex-col gap-1', className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <label htmlFor={baseId} className={cx('text-caption text-fg-muted', hideLabel && 'sr-only')}>
        {label}
      </label>
      <input
        id={baseId}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={expanded && activeOption ? optionId(active) : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => {
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className={cx(
          'h-8 w-full rounded-sm border border-line-control bg-surface px-2.5 text-body text-fg placeholder:text-fg-placeholder',
          'focus:border-focus focus:outline-2 focus:-outline-offset-1 focus:outline-focus',
          inputClassName,
        )}
      />
      <div role="status" className="sr-only">
        {expanded && !loading ? (options.length === 0 ? emptyLabel : `${String(options.length)} suggestions disponibles`) : ''}
      </div>
      {expanded ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute top-full right-0 left-0 z-40 mt-1 flex max-h-64 flex-col gap-0.5 overflow-y-auto rounded-md border border-line bg-surface p-1"
        >
          {options.length === 0 ? (
            <li role="presentation" className="px-2 py-2 text-body text-fg-subtle">
              {loading ? 'Recherche en cours' : emptyLabel}
            </li>
          ) : (
            options.map((option, index) => (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  choose(option);
                }}
                onMouseMove={() => {
                  setActive(index);
                }}
                className={cx(
                  'flex min-h-11 cursor-pointer flex-col justify-center rounded-sm px-2 text-left text-body text-fg',
                  index === active && 'bg-muted',
                )}
              >
                <span className="truncate">{option.label}</span>
                {option.description ? <span className="truncate text-caption text-fg-subtle">{option.description}</span> : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
