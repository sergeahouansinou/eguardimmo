import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import type { PageHeaderProps } from "@/components/ui/PageHeader";

export function PageFrame({ children, ...header }: PageHeaderProps & { children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <PageHeader {...header} />
      {children}
    </div>
  );
}
