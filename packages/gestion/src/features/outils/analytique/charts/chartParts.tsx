'use client';

import { createContext, use, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cx } from '@eguardimmo/ui';
import { TONE_BG } from './tones';
import type { SeriesTone } from './tones';

export interface ChartView {
  expanded: boolean;
}

export const ChartViewContext = createContext<ChartView>({ expanded: false });

export const useChartView = (): ChartView => use(ChartViewContext);

export function useChartWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.floor(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => { observer.disconnect(); };
  }, []);
  return [ref, width] as const;
}

export interface TipRowData {
  label: string;
  value: string;
  tone?: SeriesTone;
}

export interface TipData {
  title: string;
  rows: readonly TipRowData[];
}

export const TIP_WIDTH = 180;

export const valueText = (tip: TipData): string =>
  `${tip.title} : ${tip.rows.map((row) => `${row.label} ${row.value}`).join(', ')}`;

export function ChartTip({ tip, left, top, className }: { tip: TipData; left: number | string; top?: number | string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      style={{ left, top, width: TIP_WIDTH }}
      className={cx(
        'pointer-events-none absolute top-3 z-10 flex flex-col gap-1 rounded-md bg-nav px-2.5 py-2 text-caption font-normal text-fg-inverse',
        className,
      )}
    >
      <b className="font-semibold">{tip.title}</b>
      {tip.rows.map((row) => (
        <span key={row.label} className="flex items-center gap-1.5 whitespace-nowrap">
          {row.tone ? <i className={cx('size-2 shrink-0 rounded-[2px]', TONE_BG[row.tone])} /> : <i className="size-2 shrink-0" />}
          {row.label}
          <span className="ml-auto font-semibold tabular-nums">{row.value}</span>
        </span>
      ))}
    </div>
  );
}

export function LegendItem({ tone, hatched = false, children }: { tone: SeriesTone; hatched?: boolean; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <i
        aria-hidden="true"
        className={cx('size-2.5 rounded-[2px]', TONE_BG[tone], hatched && 'opacity-60')}
      />
      {children}
    </span>
  );
}

export function ChartLegend({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-4 text-caption font-normal text-fg-muted">{children}</div>;
}

export function clampIndex(index: number, count: number): number {
  return Math.min(Math.max(index, 0), Math.max(count - 1, 0));
}
