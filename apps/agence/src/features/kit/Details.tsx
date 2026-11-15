import { cx } from "@eguardimmo/ui";
import type { ReactNode } from "react";

export interface DetailItem {
  label: string;
  value: ReactNode;
}

export function DetailList({ items, className }: { items: readonly DetailItem[]; className?: string }) {
  return (
    <dl className={cx("grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-body", className)}>
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-fg-subtle">{item.label}</dt>
          <dd className="min-w-0 break-words text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface SummaryLine {
  label: string;
  value: ReactNode;
  tone?: "default" | "danger";
}

export function SummaryLines({ lines, total, className }: { lines: readonly SummaryLine[]; total?: SummaryLine; className?: string }) {
  return (
    <dl className={cx("flex flex-col text-body", className)}>
      {lines.map((line) => (
        <div key={line.label} className="flex items-center justify-between gap-3 border-b border-line py-1.5 last:border-b-0">
          <dt className="text-fg-muted">{line.label}</dt>
          <dd className={cx("text-right font-semibold tabular-nums", line.tone === "danger" ? "text-fg-danger" : "text-fg")}>
            {line.value}
          </dd>
        </div>
      ))}
      {total ? (
        <div className="flex items-center justify-between gap-3 border-t border-fg pt-2 font-semibold text-fg">
          <dt>{total.label}</dt>
          <dd className="tabular-nums">{total.value}</dd>
        </div>
      ) : null}
    </dl>
  );
}
