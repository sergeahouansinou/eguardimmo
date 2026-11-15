import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Icon, cx } from "@eguardimmo/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { IconTile } from "./IconTile";
import type { TileTone } from "./IconTile";

const optionClasses =
  "flex w-full items-start gap-3 rounded-md border border-line bg-surface p-3 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export interface OptionLinkProps {
  href?: string;
  onClick?: () => void;
  icon: LucideIcon;
  tone?: TileTone;
  title: string;
  caption: ReactNode;
}

export function OptionLink({ href, onClick, icon, tone = "info", title, caption }: OptionLinkProps) {
  const content = (
    <>
      <IconTile icon={icon} tone={tone} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-strong text-fg">{title}</span>
        <span className="text-caption text-fg-subtle">{caption}</span>
      </span>
      <Icon icon={ChevronRight} className="mt-1 text-fg-subtle" />
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cx(optionClasses)}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={optionClasses}>
      {content}
    </button>
  );
}
