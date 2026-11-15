import { cx } from "@eguardimmo/ui";
import type { ReactNode } from "react";

export interface DataListItem {
  label: string;
  value: ReactNode;
}

const widths = {
  sm: "grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)]",
  md: "grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)]",
  lg: "grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)]",
} as const;

export function DataList({ items, width = "md", className }: { items: readonly DataListItem[]; width?: keyof typeof widths; className?: string }) {
  return (
    <dl className={cx("grid gap-x-3 gap-y-1.5 text-body", widths[width], className)}>
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-fg-subtle">{item.label}</dt>
          <dd className="min-w-0 break-words text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
