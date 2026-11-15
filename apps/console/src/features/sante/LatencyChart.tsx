import { formatInteger } from '@/lib/format';

interface Point {
  label: string;
  ms: number;
}

export function LatencyChart({ points, target }: { points: readonly Point[]; target: number }) {
  const max = Math.max(target, ...points.map((point) => point.ms), 1);
  const peak = points.reduce((best, point) => (point.ms > best.ms ? point : best), points[0] ?? { label: '', ms: 0 });
  const targetPercent = (target / max) * 100;
  return (
    <figure className="flex flex-col gap-1">
      <div
        role="img"
        aria-label={`Latence p95 sur 24 heures, objectif ${formatInteger(target)} ms, pic de ${formatInteger(peak.ms)} ms à ${peak.label}`}
        className="relative flex h-36 items-end gap-0.5 border-b border-line"
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-0 border-t border-dashed border-line-strong"
          style={{ bottom: `${String(targetPercent)}%` }}
        />
        {points.map((point) => (
          <span
            key={point.label}
            aria-hidden="true"
            className="flex-1 rounded-t-sm bg-action"
            style={{ height: `${String(Math.max(2, (point.ms / max) * 100))}%` }}
          />
        ))}
      </div>
      <figcaption className="flex justify-between text-caption text-fg-subtle">
        <span>{points[0]?.label}</span>
        <span>{points.at(-1)?.label}</span>
      </figcaption>
    </figure>
  );
}
