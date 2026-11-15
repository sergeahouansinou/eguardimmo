import type { ReactNode } from 'react';

export function DescriptionList({
  items,
  termWidth = '120px',
}: {
  items: readonly { term: string; detail: ReactNode }[];
  termWidth?: string;
}) {
  return (
    <dl className="grid gap-x-3 gap-y-2 text-body" style={{ gridTemplateColumns: `minmax(0, ${termWidth}) minmax(0, 1fr)` }}>
      {items.map((item) => (
        <div key={item.term} className="contents">
          <dt className="text-fg-subtle">{item.term}</dt>
          <dd className="min-w-0 break-words text-fg">{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LedgerLines({
  lines,
  total,
}: {
  lines: readonly { label: ReactNode; value: ReactNode }[];
  total?: { label: string; value: ReactNode };
}) {
  return (
    <div className="flex flex-col">
      {lines.map((line, index) => (
        <div key={index} className="flex items-center justify-between gap-3 border-t border-line py-1.5 text-body first:border-t-0">
          <span className="text-fg-muted">{line.label}</span>
          <b className="text-right font-semibold text-fg tabular-nums">{line.value}</b>
        </div>
      ))}
      {total ? (
        <div className="mt-1 flex items-center justify-between gap-3 rounded-md bg-action-subtle px-2 py-2 text-body-strong text-action-on-subtle">
          <span>{total.label}</span>
          <span className="tabular-nums">{total.value}</span>
        </div>
      ) : null}
    </div>
  );
}
