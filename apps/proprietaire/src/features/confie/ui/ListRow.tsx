import { Icon, cx } from "@eguardimmo/ui";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type RowTone = "default" | "success" | "warning" | "danger" | "neutral";

const toneClasses: Record<RowTone, string> = {
  default: "bg-action-subtle text-action-on-subtle",
  success: "bg-success text-success-fg",
  warning: "bg-warning text-warning-fg",
  danger: "bg-danger text-danger-fg",
  neutral: "bg-muted text-fg-muted",
};

export interface ListRowProps {
  icon: LucideIcon;
  title: ReactNode;
  detail?: ReactNode;
  tone?: RowTone;
  trailing?: ReactNode;
}

export function ListRow({ icon, title, detail, tone = "default", trailing }: ListRowProps) {
  return (
    <li className="flex min-h-11 items-center gap-2.5 border-t border-line py-2 first:border-t-0">
      <span className={cx("inline-flex size-7 shrink-0 items-center justify-center rounded-md", toneClasses[tone])}>
        <Icon icon={icon} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-body-strong break-words text-fg">{title}</b>
        {detail ? <span className="text-caption break-words text-fg-subtle">{detail}</span> : null}
      </span>
      {trailing ? <span className="flex shrink-0 items-center gap-2">{trailing}</span> : null}
    </li>
  );
}

export function RowList({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-col">
      {children}
    </ul>
  );
}
