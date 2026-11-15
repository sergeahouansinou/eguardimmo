'use client';

import { Check, ChevronDown, Search } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { cx } from '../../lib/cx';
import { Icon } from '../Icon/Icon';
import { Popover, PopoverContent, PopoverTrigger } from '../Popover/Popover';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface SelectProps {
  label: string;
  placeholder: string;
  options: readonly SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  hint?: string;
  error?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  hideLabel?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

const fold = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function Select({
  label,
  placeholder,
  options,
  value,
  onValueChange,
  hint,
  error,
  searchable = false,
  searchPlaceholder = 'Rechercher',
  emptyLabel = 'Aucun résultat',
  hideLabel = false,
  disabled = false,
  id,
  className,
}: SelectProps) {
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const labelId = `${baseId}-label`;
  const valueId = `${baseId}-value`;
  const listId = `${baseId}-list`;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);
  const needle = fold(query.trim());
  const visible = needle
    ? options.filter((option) => fold(`${option.label} ${option.description ?? ''}`).includes(needle))
    : options;
  const optionId = (index: number) => `${baseId}-option-${String(index)}`;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setQuery('');
    setActive(Math.max(0, options.findIndex((option) => option.value === value)));
  };

  const choose = (index: number) => {
    const option = visible[index];
    if (!option) return;
    onValueChange(option.value);
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const last = visible.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(active + 1, last),
      ArrowUp: Math.max(active - 1, 0),
      Home: 0,
      End: last,
    };
    const move = moves[event.key];
    if (move !== undefined) {
      event.preventDefault();
      setActive(move);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      choose(active);
    }
  };

  return (
    <div className={cx('flex min-w-0 flex-col gap-1', className)}>
      <span id={labelId} className={cx('text-caption text-fg-muted', hideLabel && 'sr-only')}>
        {label}
      </span>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            id={baseId}
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-labelledby={`${labelId} ${valueId}`}
            aria-describedby={describedBy || undefined}
            aria-invalid={error ? true : undefined}
            disabled={disabled}
            className={cx(
              'flex h-8 w-full items-center justify-between gap-2 rounded-sm border border-line-control bg-surface px-2.5 text-left text-body',
              'focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus',
              'disabled:cursor-not-allowed disabled:border-line disabled:bg-disabled disabled:text-fg-disabled',
              'aria-invalid:border-danger-solid',
            )}
          >
            <span id={valueId} className={cx('min-w-0 flex-1 truncate', selected ? 'text-fg' : 'text-fg-placeholder')}>
              {selected ? selected.label : placeholder}
            </span>
            <Icon icon={ChevronDown} className="text-fg-subtle" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          aria-label={label}
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-56"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (searchable ? searchRef.current : listRef.current)?.focus();
          }}
        >
          {searchable ? (
            <div className="flex items-center gap-2 border-b border-line px-2.5">
              <Icon icon={Search} className="text-fg-subtle" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                role="searchbox"
                aria-label={searchPlaceholder}
                aria-controls={listId}
                aria-activedescendant={visible[active] ? optionId(active) : undefined}
                placeholder={searchPlaceholder}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={handleKeyDown}
                className="h-9 min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-placeholder"
              />
            </div>
          ) : null}
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            tabIndex={searchable ? -1 : 0}
            aria-activedescendant={!searchable && visible[active] ? optionId(active) : undefined}
            onKeyDown={searchable ? undefined : handleKeyDown}
            className="flex max-h-64 flex-col gap-0.5 overflow-y-auto p-1 outline-none"
          >
            {visible.length === 0 ? (
              <p className="px-2 py-2 text-body text-fg-subtle">{emptyLabel}</p>
            ) : (
              visible.map((option, index) => (
                <button
                  key={option.value}
                  id={optionId(index)}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={option.value === value}
                  onClick={() => { choose(index); }}
                  onMouseMove={() => { setActive(index); }}
                  className={cx(
                    'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-body text-fg',
                    index === active && 'bg-muted',
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{option.label}</span>
                    {option.description ? (
                      <span className="truncate text-caption text-fg-subtle">{option.description}</span>
                    ) : null}
                  </span>
                  {option.value === value ? <Icon icon={Check} className="text-action" /> : null}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
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
