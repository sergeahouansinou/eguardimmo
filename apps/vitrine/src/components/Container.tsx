import { cx } from "@eguardimmo/ui";
import type { ComponentProps } from "react";

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cx("mx-auto w-full max-w-6xl px-4", className)} />;
}
