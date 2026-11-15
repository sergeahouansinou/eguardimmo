'use client';

import { useId, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { formatCompactMajor } from '../../../../format/money';
import { labelEvery, niceScale, roundedTopPath, showLabel } from './scale';
import { ChartTip, TIP_WIDTH, clampIndex, useChartView, useChartWidth, valueText } from './chartParts';
import type { TipData } from './chartParts';
import { TONES, TONE_FILL } from './tones';
import type { SeriesTone } from './tones';

const PAD = { left: 40, right: 4, top: 8, bottom: 22 };
const TICKS = 4;

export interface BarCategory {
  key: string;
  label: string;
}

export interface BarSeries {
  key: string;
  tone: SeriesTone;
  values: readonly number[];
}

export interface GroupedBarChartProps {
  label: string;
  categories: readonly BarCategory[];
  series: readonly BarSeries[];
  tip: (index: number) => TipData;
  initialActive?: number;
  projectionFrom?: number;
  projectionLabel?: string;
  height?: number;
}

export function GroupedBarChart({
  label,
  categories,
  series,
  tip,
  initialActive,
  projectionFrom,
  projectionLabel = 'Projection',
  height = 220,
}: GroupedBarChartProps) {
  const { expanded } = useChartView();
  const [ref, width] = useChartWidth(733);
  const uid = useId();
  const [picked, setPicked] = useState<number | null>(null);
  const count = categories.length;
  if (count === 0) return <p className="text-body text-fg-subtle">Aucune donnée sur la période.</p>;

  const chartHeight = expanded ? Math.round(height * 1.8) : height;
  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = chartHeight - PAD.top - PAD.bottom;
  const bottom = PAD.top + plotHeight;
  const peak = Math.max(0, ...series.flatMap((entry) => entry.values));
  const { step, top } = niceScale(peak, TICKS);
  const y = (value: number) => bottom - (Math.max(0, value) / top) * plotHeight;
  const band = plotWidth / count;
  const bandStart = (index: number) => PAD.left + index * band;
  const barWidth = Math.max(3, Math.min(16, (band - 6) / series.length - 2));
  const groupWidth = series.length * barWidth + (series.length - 1) * 2;
  const active = clampIndex(picked ?? initialActive ?? count - 1, count);
  const every = labelEvery(count, plotWidth);
  const tipLeft = active >= count / 2 ? bandStart(active) + band - TIP_WIDTH - 4 : bandStart(active) + 4;
  const hatchId = (tone: SeriesTone) => `${uid}-hatch-${tone}`;
  const usedTones = TONES.filter((tone) => series.some((entry) => entry.tone === tone));

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const index = Math.floor((event.clientX - box.left - PAD.left) / band);
    if (index >= 0 && index < count) setPicked(index);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: count - 1,
    };
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
        <defs>
          {usedTones.map((tone) => (
            <pattern key={tone} id={hatchId(tone)} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="4" height="4" className={`${TONE_FILL[tone]} opacity-20`} />
              <rect width="2" height="4" className={TONE_FILL[tone]} />
            </pattern>
          ))}
        </defs>
        {Array.from({ length: TICKS + 1 }, (_, tick) => {
          const value = step * tick;
          const lineY = y(value);
          return (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={lineY} y2={lineY} className="stroke-chart-grid" />
              <text x={PAD.left - 6} y={lineY + 4} textAnchor="end" className="fill-fg-subtle text-[11px]">
                {formatCompactMajor(value, 'EUR')}
              </text>
            </g>
          );
        })}
        <rect x={bandStart(active) + 2} y={PAD.top} width={band - 4} height={plotHeight} rx={4} className="fill-chart-highlight" />
        {projectionFrom !== undefined && projectionFrom > 0 && projectionFrom < count ? (
          <g>
            <line
              x1={bandStart(projectionFrom)}
              x2={bandStart(projectionFrom)}
              y1={PAD.top}
              y2={bottom}
              strokeDasharray="3 3"
              className="stroke-chart-called"
            />
            <text x={bandStart(projectionFrom) + 6} y={PAD.top + 10} className="fill-fg-subtle text-[11px]">
              {projectionLabel}
            </text>
          </g>
        ) : null}
        {categories.map((category, index) => {
          const center = bandStart(index) + band / 2;
          const start = center - groupWidth / 2;
          const projected = projectionFrom !== undefined && index >= projectionFrom;
          return (
            <g key={category.key}>
              {series.map((entry, position) => {
                const value = entry.values[index] ?? 0;
                if (value <= 0) return null;
                const x = start + position * (barWidth + 2);
                return projected ? (
                  <path key={entry.key} d={roundedTopPath(x, y(value), barWidth, bottom)} fill={`url(#${hatchId(entry.tone)})`} />
                ) : (
                  <path key={entry.key} d={roundedTopPath(x, y(value), barWidth, bottom)} className={TONE_FILL[entry.tone]} />
                );
              })}
              {showLabel(index, count, every) ? (
                <text x={center} y={chartHeight - 6} textAnchor="middle" className="fill-fg-subtle text-[11px]">
                  {category.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <ChartTip tip={tip(active)} left={tipLeft} />
    </div>
  );
}
