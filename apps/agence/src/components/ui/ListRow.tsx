import { Icon, cx } from "@eguardimmo/ui";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type RowTone = "success" | "warning" | "danger" | "info" | "neutral";

const toneClasses: Record<RowTone, string> = {
  success: "bg-success text-success-fg",
  warning: "bg-warning text-warning-fg",
  danger: "bg-danger text-danger-fg",
  info: "bg-info text-info-fg",
  neutral: "bg-muted text-fg-muted",
};

export interface ListRowProps {
  icon?: LucideIcon;
  tone?: RowTone;
  title: ReactNode;
  caption?: ReactNode;
  trailing?: ReactNode;
}

export function ListRow({ icon, tone = "neutral", title, caption, trailing }: ListRowProps) {
  return (
    <div className="flex items-center gap-2.5 border-b border-line py-2 last:border-b-0">
      {icon ? (
        <span className={cx("inline-flex size-7 shrink-0 items-center justify-center rounded-md", toneClasses[tone])}>
          <Icon icon={icon} />
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-strong text-fg">{title}</span>
        {caption ? <span className="truncate text-caption text-fg-subtle">{caption}</span> : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
