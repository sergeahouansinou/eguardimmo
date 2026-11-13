'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { cx } from '@eguardimmo/ui';
import type { BureauData } from '../data/schemas';
import { formatCompactMajor, formatMoney } from '../format/money';
import type { Currency } from '../format/money';
import { formatMonthLong, formatMonthShort } from '../format/dates';

const HEIGHT = 196;
const PAD = { left: 40, right: 4, top: 8, bottom: 22 };
const BAR = 16;
const BAR_GAP = 2;
const TIP_WIDTH = 180;
const TICKS = 4;

export function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = [1, 2, 2.5, 5, 10].find((candidate) => candidate * power >= raw) ?? 10;
  return unit * power;
}

function roundedTop(x: number, y: number, width: number, bottom: number): string {
  const r = Math.min(4, (bottom - y) / 2, width / 2);
  return `M${String(x)},${String(bottom)}V${String(y + r)}Q${String(x)},${String(y)} ${String(x + r)},${String(y)}H${String(x + width - r)}Q${String(x + width)},${String(y)} ${String(x + width)},${String(y + r)}V${String(bottom)}Z`;
}

function useWidth(fallback: number) {
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

export interface RentChartProps {
  history: BureauData['rentHistory'];
  currency: Currency;
}

export function RentChart({ history, currency }: RentChartProps) {
  const [ref, width] = useWidth(731);
  const [active, setActive] = useState(history.length - 1);
  if (history.length === 0) {
    return <p className="text-body text-fg-subtle">Aucun loyer appelé sur la période.</p>;
  }

  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const bottom = PAD.top + plotHeight;
  const peak = Math.max(...history.flatMap((month) => [month.called, month.collected]));
  const step = niceStep(peak / TICKS);
  const top = step * TICKS;
  const y = (value: number) => bottom - (Math.max(0, value) / top) * plotHeight;
  const band = plotWidth / history.length;
  const bandStart = (index: number) => PAD.left + index * band;
  const current = history[Math.min(active, history.length - 1)];
  const due = current ? Math.max(0, current.called - current.collected) : 0;
  const tipLeft =
    active >= history.length / 2 ? bandStart(active) + band - TIP_WIDTH - 4 : bandStart(active) + 4;

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const index = Math.floor((event.clientX - box.left - PAD.left) / band);
    if (index >= 0 && index < history.length) setActive(index);
  };

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${String(width)} ${String(HEIGHT)}`}
        aria-hidden="true"
        onPointerMove={onPointerMove}
        onPointerLeave={() => { setActive(history.length - 1); }}
        className="block font-sans"
      >
        {Array.from({ length: TICKS + 1 }, (_, tick) => {
          const value = step * tick;
          const lineY = y(value);
          return (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={lineY} y2={lineY} className="stroke-chart-grid" />
              <text x={PAD.left - 6} y={lineY + 4} textAnchor="end" className="fill-fg-subtle text-[11px]">
                {formatCompactMajor(value, currency)}
              </text>
            </g>
          );
        })}
        <rect x={bandStart(active) + 2} y={PAD.top} width={band - 4} height={plotHeight} rx={4} className="fill-chart-highlight" />
        {history.map((month, index) => {
          const center = bandStart(index) + band / 2;
          const calledX = center - BAR - BAR_GAP / 2;
          const collectedX = center + BAR_GAP / 2;
          return (
            <g key={month.month}>
              {month.called > 0 ? <path d={roundedTop(calledX, y(month.called), BAR, bottom)} className="fill-chart-called" /> : null}
              {month.collected > 0 ? (
                <path d={roundedTop(collectedX, y(month.collected), BAR, bottom)} className="fill-chart-collected" />
              ) : null}
              <text x={center} y={HEIGHT - 6} textAnchor="middle" className="fill-fg-subtle text-[11px]">
                {formatMonthShort(month.month)}
              </text>
            </g>
          );
        })}
      </svg>
      {current ? (
        <div
          aria-hidden="true"
          style={{ left: tipLeft, width: TIP_WIDTH }}
          className="pointer-events-none absolute top-3 z-10 flex flex-col gap-1 rounded-md bg-nav px-2.5 py-2 text-caption font-normal text-fg-inverse"
        >
          <b className="font-semibold">{formatMonthLong(current.month)}</b>
          <TipRow swatch="bg-chart-called" label="Appelé" value={formatMoney(current.called, currency)} />
          <TipRow swatch="bg-chart-collected" label="Encaissé" value={formatMoney(current.collected, currency)} />
          {due > 0 ? <TipRow swatch="bg-chart-due" label="Reste dû" value={formatMoney(due, currency)} /> : null}
        </div>
      ) : null}
      <table className="sr-only">
        <caption>Loyers appelés et encaissés par mois</caption>
        <thead>
          <tr>
            <th scope="col">Mois</th>
            <th scope="col">Appelé</th>
            <th scope="col">Encaissé</th>
          </tr>
        </thead>
        <tbody>
          {history.map((month) => (
            <tr key={month.month}>
              <th scope="row">{formatMonthLong(month.month)}</th>
              <td>{formatMoney(month.called, currency)}</td>
              <td>{formatMoney(month.collected, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TipRow({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <i className={cx('size-2 shrink-0 rounded-[2px]', swatch)} />
      {label}
      <span className="ml-auto font-semibold tabular-nums">{value}</span>
    </span>
  );
}

export function ChartLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-caption font-normal text-fg-muted">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <i aria-hidden="true" className="size-2.5 rounded-[2px] bg-chart-called" />
        Appelé
      </span>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <i aria-hidden="true" className="size-2.5 rounded-[2px] bg-chart-collected" />
        Encaissé
      </span>
    </div>
  );
}
