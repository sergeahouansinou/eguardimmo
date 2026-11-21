import { formatCompactMajor } from '../../format/money';
import type { Currency } from '../../format/money';
import { monthLabel } from './period';

export interface BarSeries {
  label: string;
  values: readonly number[];
  hatched: boolean;
}

const WIDTH = 720;
const HEIGHT = 260;
const PAD = { top: 12, right: 12, bottom: 34, left: 56 };
const TICKS = 4;

export function MonthlyBars({ title, summary, months, series, currency, idPrefix }: { title: string; summary: string; months: readonly string[]; series: readonly BarSeries[]; currency: Currency; idPrefix: string }) {
  const all = series.flatMap((serie) => serie.values);
  const max = Math.max(0, ...all);
  const min = Math.min(0, ...all);
  const span = max - min || 1;
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const y = (value: number): number => PAD.top + ((max - value) / span) * plotH;
  const group = plotW / Math.max(1, months.length);
  const bar = Math.max(2, Math.min(24, (group * 0.8) / Math.max(1, series.length)));
  const labelEvery = Math.max(1, Math.ceil(months.length / 12));
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;
  const hatch = `${idPrefix}-hatch`;

  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <svg viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`} role="img" aria-labelledby={`${titleId} ${descId}`} className="h-auto w-full max-w-full">
        <title id={titleId}>{title}</title>
        <desc id={descId}>{summary}</desc>
        <defs>
          <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" className="fill-surface" />
            <rect width="2.5" height="6" className="fill-fg-muted" />
          </pattern>
        </defs>
        {Array.from({ length: TICKS + 1 }, (_, i) => {
          const value = min + (span / TICKS) * i;
          return (
            <g key={i}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(value)} y2={y(value)} className="stroke-line" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(value) + 4} textAnchor="end" className="fill-fg-muted text-[11px]">{formatCompactMajor(Math.round(value), currency)}</text>
            </g>
          );
        })}
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(0)} y2={y(0)} className="stroke-fg-muted" strokeWidth={1.5} />
        {months.map((month, monthIndex) => {
          const x0 = PAD.left + group * monthIndex + (group - bar * series.length) / 2;
          return (
            <g key={month}>
              {series.map((serie, serieIndex) => {
                const value = serie.values[monthIndex] ?? 0;
                const top = Math.min(y(value), y(0));
                return (
                  <rect key={serie.label} x={x0 + bar * serieIndex} y={top} width={bar - 1} height={Math.max(1, Math.abs(y(value) - y(0)))} className={serie.hatched ? 'stroke-fg-muted' : 'fill-action stroke-action'} fill={serie.hatched ? `url(#${hatch})` : undefined} strokeWidth={1} />
                );
              })}
              {monthIndex % labelEvery === 0 ? (
                <text x={PAD.left + group * monthIndex + group / 2} y={HEIGHT - 12} textAnchor="middle" className="fill-fg-muted text-[11px]">{monthLabel(month, 'short')}</text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap items-center gap-3 text-caption text-fg-muted">
        {series.map((serie) => (
          <span key={serie.label} className="inline-flex items-center gap-1">
            <svg width="14" height="14" aria-hidden="true">
              <rect width="14" height="14" className={serie.hatched ? 'stroke-fg-muted' : 'fill-action stroke-action'} fill={serie.hatched ? `url(#${hatch})` : undefined} />
            </svg>
            {serie.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
