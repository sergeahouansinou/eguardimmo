import { StatCard, cx } from "@eguardimmo/ui";
import type { ReactNode } from "react";

export function KpiGrid({ columns, children }: { columns: 3 | 4; children: ReactNode }) {
  return (
    <div className={cx("grid grid-cols-1 gap-3 sm:grid-cols-2", columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4")}>{children}</div>
  );
}

export interface KpiProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "danger";
}

export function Kpi({ label, value, hint, tone }: KpiProps) {
  return (
    <StatCard label={label} value={value} tone={tone}>
      {hint ? <span className="text-caption text-fg-subtle">{hint}</span> : null}
    </StatCard>
  );
}
