'use client';

import { Tooltip, cx } from '@eguardimmo/ui';
import { formatDate, formatDuration } from '../lib/dates';
import { buildTimeline, yearTicks } from '../lib/timeline';
import type { Period } from '../schemas/lots';

function describe(period: Period, asOf: string): string {
  const end = period.endDate ?? asOf;
  const who = period.kind === 'bail' ? (period.occupant?.name ?? 'Locataire') : 'Vacance';
  const type = period.leaseType ? `, ${period.leaseType}` : '';
  return `${who}${type} · ${formatDate(period.startDate)} au ${period.endDate ? formatDate(period.endDate) : 'ce jour'} · ${formatDuration(period.startDate, end)}`;
}

export function OccupationTimeline({ periods, asOf }: { periods: readonly Period[]; asOf: string }) {
  const segments = buildTimeline(periods, asOf);
  const ticks = yearTicks(periods, asOf);
  let leaseIndex = 0;
  return (
    <div className="flex flex-col gap-1">
      <ul aria-label="Frise d’occupation" className="flex h-7 w-full gap-px overflow-hidden rounded-sm">
        {segments.map(({ period, share }) => {
          const tone = period.kind === 'vacance' ? 'bg-muted' : leaseIndex++ % 2 === 0 ? 'bg-action' : 'bg-accent';
          const text = describe(period, asOf);
          return (
            <li key={period.id} className="min-w-[3px]" style={{ flexGrow: share, flexBasis: 0 }}>
              <Tooltip content={text}>
                <button type="button" aria-label={text} className={cx('block h-full w-full focus-visible:outline-2 focus-visible:outline-focus', tone)} />
              </Tooltip>
            </li>
          );
        })}
      </ul>
      <div aria-hidden="true" className="relative h-4 text-[10px] leading-4 text-fg-subtle">
        <span className="absolute left-0">{segments[0] ? formatDate(segments[0].period.startDate).slice(3) : ''}</span>
        {ticks.map((tick) => (
          <span key={tick.label} className="absolute -translate-x-1/2" style={{ left: `${String(tick.share * 100)}%` }}>
            {tick.label}
          </span>
        ))}
        <span className="absolute right-0">{formatDate(asOf).slice(3)}</span>
      </div>
    </div>
  );
}
