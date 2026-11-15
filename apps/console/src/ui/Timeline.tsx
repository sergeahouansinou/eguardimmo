import { cx } from '@eguardimmo/ui';

export interface TimelineEntry {
  id: string;
  time: string;
  title: string;
  detail?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

const dotTone = {
  default: 'bg-action',
  success: 'bg-success-fg',
  warning: 'bg-warning-fg',
  danger: 'bg-fg-danger',
} as const;

export function Timeline({ entries }: { entries: readonly TimelineEntry[] }) {
  return (
    <ol className="flex flex-col">
      {entries.map((entry, index) => (
        <li key={entry.id} className="grid grid-cols-[44px_12px_minmax(0,1fr)] gap-2 py-1.5 max-sm:grid-cols-[40px_12px_minmax(0,1fr)]">
          <time className="text-caption leading-5 font-medium text-fg-subtle tabular-nums">{entry.time}</time>
          <span className="relative mt-1.5 flex justify-center">
            <span aria-hidden="true" className={cx('size-2.5 rounded-full', dotTone[entry.tone ?? 'default'])} />
            {index < entries.length - 1 ? (
              <span aria-hidden="true" className="absolute top-3.5 left-1/2 h-[calc(100%+12px)] w-0.5 -translate-x-1/2 bg-line" />
            ) : null}
          </span>
          <div className="flex min-w-0 flex-col">
            <b className="text-body-strong break-words text-fg">{entry.title}</b>
            {entry.detail ? <span className="text-caption break-words text-fg-subtle">{entry.detail}</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
