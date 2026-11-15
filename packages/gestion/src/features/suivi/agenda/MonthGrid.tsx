'use client';

import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { cx } from '@eguardimmo/ui';
import { addDays, addMonthsClamped, formatDayLabel, monthWeeks, parseIso, weekdayIndex, yearMonthOf, formatMonthTitle } from '../shared/dates';
import { categoryBorder, categorySwatch } from './calendar';
import type { AgendaEntry } from './calendar';

const WEEKDAYS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'] as const;
const VISIBLE_ENTRIES = 3;

export interface MonthGridProps {
  month: string;
  today: string;
  focused: string;
  entries: ReadonlyMap<string, readonly AgendaEntry[]>;
  onFocusedChange: (date: string) => void;
}

function targetFor(key: string, date: string): string | null {
  switch (key) {
    case 'ArrowLeft':
      return addDays(date, -1);
    case 'ArrowRight':
      return addDays(date, 1);
    case 'ArrowUp':
      return addDays(date, -7);
    case 'ArrowDown':
      return addDays(date, 7);
    case 'Home':
      return addDays(date, -weekdayIndex(date));
    case 'End':
      return addDays(date, 6 - weekdayIndex(date));
    case 'PageUp':
      return addMonthsClamped(date, -1);
    case 'PageDown':
      return addMonthsClamped(date, 1);
    default:
      return null;
  }
}

export function MonthGrid({ month, today, focused, entries, onFocusedChange }: MonthGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);
  const weeks = monthWeeks(month);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-date="${focused}"]`)?.focus();
  }, [focused, month]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, date: string) => {
    const target = targetFor(event.key, date);
    if (target === null) return;
    event.preventDefault();
    moveFocus.current = true;
    onFocusedChange(target);
  };

  const tabbable = weeks.some((week) => week.includes(focused)) ? focused : `${month}-01`;

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label={formatMonthTitle(month)}
      className="overflow-hidden rounded-lg border border-line bg-surface"
    >
      <div role="row" className="grid grid-cols-7 bg-muted">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} role="columnheader" className="p-1.5 text-caption font-semibold text-fg-muted">
            {weekday}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} role="row" className="grid grid-cols-7">
          {week.map((date) => {
            const inMonth = yearMonthOf(date) === month;
            const dayEntries = entries.get(date) ?? [];
            const isToday = date === today;
            return (
              <div
                key={date}
                role="gridcell"
                data-date={date}
                tabIndex={date === tabbable ? 0 : -1}
                aria-selected={date === focused}
                aria-current={isToday ? 'date' : undefined}
                onClick={() => { onFocusedChange(date); }}
                onKeyDown={(event) => { onKeyDown(event, date); }}
                className={cx(
                  'flex min-h-14 min-w-0 flex-col gap-0.5 border-r border-b border-line p-1 text-caption outline-none sm:min-h-[72px]',
                  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                  'last:border-r-0',
                  isToday && 'bg-action-subtle',
                  date === focused && 'ring-1 ring-inset ring-action',
                  inMonth ? 'text-fg-muted' : 'text-fg-disabled',
                )}
              >
                <span className="sr-only">{`${formatDayLabel(date)}, ${dayEntries.length === 0 ? 'aucun événement' : `${String(dayEntries.length)} événement${dayEntries.length > 1 ? 's' : ''}`}`}</span>
                <span aria-hidden="true" className={cx(isToday && 'font-semibold text-fg')}>{parseIso(date).day}</span>
                <ul className="flex min-w-0 flex-col gap-0.5">
                  {dayEntries.slice(0, VISIBLE_ENTRIES).map((entry) => (
                    <li key={entry.key} className="flex min-w-0 items-center">
                      <i aria-hidden="true" className={cx('size-2 shrink-0 rounded-full sm:hidden', categorySwatch[entry.category])} />
                      <span
                        className={cx(
                          'sr-only sm:not-sr-only sm:block sm:min-w-0 sm:truncate sm:rounded-sm sm:border-l-[3px] sm:px-1 sm:text-fg',
                          categoryBorder[entry.category],
                        )}
                      >
                        {entry.title}
                      </span>
                    </li>
                  ))}
                  {dayEntries.length > VISIBLE_ENTRIES ? (
                    <li className="px-1 text-fg-subtle">{`+${String(dayEntries.length - VISIBLE_ENTRIES)} autre${dayEntries.length - VISIBLE_ENTRIES > 1 ? 's' : ''}`}</li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
