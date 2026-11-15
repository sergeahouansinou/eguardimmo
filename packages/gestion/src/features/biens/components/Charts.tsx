'use client';

import { Badge, cx } from '@eguardimmo/ui';
import type { BadgeTone } from '@eguardimmo/ui';
import type { Letter } from '../schemas/common';

export interface BarPoint {
  id: string;
  label: string;
  primary: number;
  secondary?: number;
  caption: string;
}

export function BarChart({ points, title, primaryLabel, secondaryLabel }: { points: readonly BarPoint[]; title: string; primaryLabel: string; secondaryLabel?: string }) {
  const max = Math.max(1, ...points.flatMap((point) => [point.primary, point.secondary ?? 0]));
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex flex-wrap items-center gap-3 text-caption text-fg-subtle">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-action" />
          {primaryLabel}
        </span>
        {secondaryLabel ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-sm bg-accent" />
            {secondaryLabel}
          </span>
        ) : null}
      </figcaption>
      <ul aria-label={title} className="flex h-28 items-end gap-1">
        {points.map((point) => (
          <li key={point.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="sr-only">{`${point.label} : ${point.caption}`}</span>
            <span aria-hidden="true" className="flex h-full w-full items-end justify-center gap-px">
              <span className="w-full max-w-3 rounded-t-sm bg-action" style={{ height: `${String(Math.max(2, (point.primary / max) * 100))}%` }} />
              {point.secondary === undefined ? null : (
                <span className="w-full max-w-3 rounded-t-sm bg-accent" style={{ height: `${String(Math.max(2, (point.secondary / max) * 100))}%` }} />
              )}
            </span>
            <span aria-hidden="true" className="truncate text-[10px] leading-3 text-fg-subtle">
              {point.label}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

const LETTERS: readonly Letter[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const letterTones: Record<Letter, BadgeTone> = {
  A: 'success',
  B: 'success',
  C: 'info',
  D: 'info',
  E: 'warning',
  F: 'danger',
  G: 'danger',
};

export function EnergyScale({ title, letter, value, unit }: { title: string; letter: Letter; value: number; unit: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-caption font-medium text-fg-muted">{title}</p>
      <ul aria-label={`${title}, classe ${letter}`} className="flex flex-col gap-0.5">
        {LETTERS.map((entry) => (
          <li key={entry} className="flex items-center gap-2" aria-current={entry === letter ? 'true' : undefined}>
            <Badge tone={letterTones[entry]} className={cx(entry === letter ? 'ring-2 ring-focus' : 'opacity-60')}>
              {entry}
            </Badge>
            {entry === letter ? <span className="text-caption text-fg">{`${String(value)} ${unit}`}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
