import { Icon, cx } from "@eguardimmo/ui";
import type { LucideIcon } from "lucide-react";

export type TileTone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClasses: Record<TileTone, string> = {
  neutral: "bg-muted text-fg-muted",
  info: "bg-action-subtle text-action-on-subtle",
  success: "bg-success text-success-fg",
  warning: "bg-warning text-warning-fg",
  danger: "bg-danger text-danger-fg",
};

export function IconTile({
  icon,
  tone = "info",
  large = false,
}: {
  icon: LucideIcon;
  tone?: TileTone;
  large?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex shrink-0 items-center justify-center",
        large ? "size-12 rounded-lg" : "size-7 rounded-md",
        toneClasses[tone],
      )}
    >
      <Icon icon={icon} size={large ? 20 : 16} />
    </span>
  );
}
