'use client';

import { useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { ChartTip, TIP_WIDTH, clampIndex, useChartView, useChartWidth, valueText } from './chartParts';
import type { TipData } from './chartParts';
import { labelEvery, showLabel } from './scale';

const PAD = { left: 40, right: 44, top: 12, bottom: 22 };

export interface LinePoint {
  key: string;
  label: string;
  value: number;
}

export interface LineAreaChartProps {
  label: string;
  points: readonly LinePoint[];
  tip: (index: number) => TipData;
  format: (value: number) => string;
  height?: number;
}

export function LineAreaChart({ label, points, tip, format, height = 180 }: LineAreaChartProps) {
  const { expanded } = useChartView();
  const [ref, width] = useChartWidth(346);
  const [picked, setPicked] = useState<number | null>(null);
  const count = points.length;
  if (count === 0) return <p className="text-body text-fg-subtle">Aucune donnée sur la période.</p>;

  const chartHeight = expanded ? Math.round(height * 1.8) : height;
  const minValue = Math.min(...points.map((point) => point.value));
  const low = Math.min(80, Math.floor(minValue / 10) * 10);
  const high = 100;
  const plotWidth = width - PAD.left - PAD.right;
  const bottom = chartHeight - PAD.bottom;
  const plotHeight = bottom - PAD.top;
  const y = (value: number) => bottom - ((value - low) / (high - low)) * plotHeight;
  const x = (index: number) => (count === 1 ? PAD.left + plotWidth : PAD.left + (index / (count - 1)) * plotWidth);
  const last = count - 1;
  const active = clampIndex(picked ?? last, count);
  const line = points.map((point, index) => `${String(x(index))},${String(y(point.value))}`).join(' ');
  const area = `${String(x(0))},${String(bottom)} ${line} ${String(x(last))},${String(bottom)}`;
  const every = labelEvery(count, plotWidth, 34);
  const ticks = Array.from({ length: (high - low) / 10 + 1 }, (_, index) => low + index * 10);
  const tipLeft = Math.min(Math.max(x(active) - TIP_WIDTH / 2, 4), width - TIP_WIDTH - 4);
  const activePoint = points[active];

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (count < 2) return;
    const box = event.currentTarget.getBoundingClientRect();
    const index = Math.round(((event.clientX - box.left - PAD.left) / plotWidth) * (count - 1));
    setPicked(clampIndex(index, count));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: last };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setPicked(clampIndex(next, count));
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-valuemin={0}
      aria-valuemax={Math.max(count - 1, 0)}
      aria-valuenow={active}
      aria-valuetext={valueText(tip(active))}
      aria-label={`${label}. Flèches gauche et droite pour parcourir les données.`}
      onKeyDown={onKeyDown}
      onBlur={() => { setPicked(null); }}
      className="relative w-full rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <svg
        width={width}
        height={chartHeight}
        viewBox={`0 0 ${String(width)} ${String(chartHeight)}`}
        aria-hidden="true"
        onPointerMove={onPointerMove}
        onPointerLeave={() => { setPicked(null); }}
        className="block font-sans"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={PAD.left + plotWidth} y1={y(tick)} y2={y(tick)} className="stroke-chart-grid" />
            <text x={PAD.left - 6} y={y(tick) + 4} textAnchor="end" className="fill-fg-subtle text-[11px]">
              {`${String(tick)} %`}
            </text>
          </g>
        ))}
        <polygon points={area} className="fill-chart-collected opacity-10" />
        <polyline points={line} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-chart-collected" />
        {picked !== null ? (
          <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={bottom} className="stroke-chart-called" strokeDasharray="3 3" />
        ) : null}
        {activePoint ? (
          <>
            <circle cx={x(active)} cy={y(activePoint.value)} r={4.5} strokeWidth={2} className="fill-chart-collected stroke-surface" />
            {picked === null ? (
              <text x={x(active) + 8} y={y(activePoint.value) + 4} className="fill-fg text-[12px] font-semibold">
                {format(activePoint.value)}
              </text>
            ) : null}
          </>
        ) : null}
        {points.map((point, index) =>
          showLabel(index, count, every) ? (
            <text key={point.key} x={x(index)} y={chartHeight - 6} textAnchor="middle" className="fill-fg-subtle text-[11px]">
              {point.label}
            </text>
          ) : null,
        )}
      </svg>
      {picked !== null ? <ChartTip tip={tip(active)} left={tipLeft} /> : null}
    </div>
  );
}
