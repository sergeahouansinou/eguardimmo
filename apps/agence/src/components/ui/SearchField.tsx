import { Icon, cx } from "@eguardimmo/ui";
import { Search } from "lucide-react";
import type { ComponentProps } from "react";

export interface SearchFieldProps extends Omit<ComponentProps<"input">, "type" | "placeholder" | "aria-label"> {
  label: string;
  placeholder: string;
}

export function SearchField({ label, placeholder, className, ...props }: SearchFieldProps) {
  return (
    <label className={cx("relative flex min-w-0 items-center", className)}>
      <span className="sr-only">{label}</span>
      <Icon icon={Search} className="pointer-events-none absolute left-2.5 text-fg-subtle" />
      <input
        {...props}
        type="search"
        placeholder={placeholder}
        className="h-8 w-full rounded-sm border border-line-control bg-surface pr-2.5 pl-8 text-body text-fg placeholder:text-fg-placeholder focus:border-focus focus:outline-2 focus:-outline-offset-1 focus:outline-focus"
      />
    </label>
  );
}
