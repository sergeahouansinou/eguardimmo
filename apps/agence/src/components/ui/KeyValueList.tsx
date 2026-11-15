import { cx } from "@eguardimmo/ui";

export interface KeyValueItem {
  label: string;
  value: string;
}

export function KeyValueList({ items, columns = 1, className }: { items: readonly KeyValueItem[]; columns?: 1 | 2; className?: string }) {
  return (
    <dl className={cx("grid gap-x-6 gap-y-2", columns === 2 ? "sm:grid-cols-2" : "grid-cols-1", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col">
          <dt className="text-caption text-fg-subtle">{item.label}</dt>
          <dd className="min-w-0 text-body text-fg [overflow-wrap:anywhere]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
