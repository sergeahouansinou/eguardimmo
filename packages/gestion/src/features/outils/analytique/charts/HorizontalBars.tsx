'use client';

import { cx } from '@eguardimmo/ui';
import { TONE_BG } from './tones';
import type { SeriesTone } from './tones';

export interface HorizontalBarRow {
  key: string;
  label: string;
  value: number;
  text: string;
}

export interface HorizontalBarsProps {
  label: string;
  rows: readonly HorizontalBarRow[];
  tone: SeriesTone;
  selectedKey?: string;
  onSelect?: (key: string) => void;
}

const rowClass = 'grid min-h-7 grid-cols-[minmax(5rem,9rem)_minmax(0,1fr)_auto] items-center gap-2 rounded-sm px-1 text-left text-body';

export function HorizontalBars({ label, rows, tone, selectedKey, onSelect }: HorizontalBarsProps) {
  const peak = Math.max(0, ...rows.map((row) => row.value));
  return (
    <ul aria-label={label} className="flex flex-col gap-1">
      {rows.map((row) => {
        const selected = selectedKey === row.key;
        const content = (
          <>
            <span className="min-w-0 truncate text-fg-muted">{row.label}</span>
            <span aria-hidden="true" className="flex h-4 min-w-0 items-center">
              <span
                style={{ width: `${String(peak === 0 ? 0 : Math.max((row.value / peak) * 100, row.value > 0 ? 2 : 0))}%` }}
                className={cx('h-full rounded-r-sm', TONE_BG[tone])}
              />
            </span>
            <span className="font-semibold text-fg tabular-nums">{row.text}</span>
          </>
        );
        return (
          <li key={row.key}>
            {onSelect ? (
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => { onSelect(row.key); }}
                className={cx(
                  rowClass,
                  'w-full cursor-pointer hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
                  selected && 'bg-action-subtle',
                )}
              >
                {content}
              </button>
            ) : (
              <div className={rowClass}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
