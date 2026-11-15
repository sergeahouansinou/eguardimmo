import type { ReactNode } from "react";

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 [&>*]:min-w-0 max-sm:[&>*]:w-full sm:[&>label]:w-60 sm:[&>div]:w-48">{children}</div>;
}
