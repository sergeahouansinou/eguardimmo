import { Icon, cx } from "@eguardimmo/ui";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type TimelineTone = "default" | "success" | "warning" | "danger" | "neutral";

export interface TimelineItem {
  id: string;
  title: string;
  detail?: string;
  icon: LucideIcon;
  tone?: TimelineTone;
  trailing?: ReactNode;
}

const toneClasses: Record<TimelineTone, string> = {
  default: "bg-action-subtle text-action-on-subtle",
  success: "bg-success text-success-fg",
  warning: "bg-warning text-warning-fg",
  danger: "bg-danger text-danger-fg",
  neutral: "bg-muted text-fg-subtle",
};

export function Timeline({ items, label }: { items: readonly TimelineItem[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-col">
      {items.map((item) => (
        <li key={item.id} className="flex min-h-12 items-center gap-2.5 border-t border-line py-2 first:border-t-0">
          <span className={cx("inline-flex size-7 shrink-0 items-center justify-center rounded-md", toneClasses[item.tone ?? "default"])}>
            <Icon icon={item.icon} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <b className="text-body-strong text-fg">{item.title}</b>
            {item.detail ? <span className="text-caption text-fg-subtle">{item.detail}</span> : null}
          </span>
          {item.trailing}
        </li>
      ))}
    </ol>
  );
}
