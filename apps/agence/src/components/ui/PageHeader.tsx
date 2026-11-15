import { Breadcrumb } from "@eguardimmo/ui";
import type { BreadcrumbItem } from "@eguardimmo/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  crumbs?: readonly BreadcrumbItem[];
  title: string;
  badges?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ crumbs, title, badges, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-2">
      {crumbs ? <Breadcrumb items={crumbs} Link={Link} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-page-title">{title}</h1>
            {badges}
          </div>
          {description ? <p className="text-body text-fg-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
