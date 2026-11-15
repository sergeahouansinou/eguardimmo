"use client";

import { Badge, Breadcrumb, Card, CardHeader, CardTitle } from "@eguardimmo/ui";
import type { BadgeTone, BreadcrumbItem } from "@eguardimmo/ui";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { ComponentProps, ReactNode } from "react";
import { IconTile } from "@/components/IconTile";
import type { TileTone } from "@/components/IconTile";
import { NoticeBanner } from "./NoticeBanner";

function NavAnchor({ href, ...props }: ComponentProps<"a"> & { href: string }) {
  return <Link href={href} {...props} />;
}

export function PageHead({
  crumbs,
  title,
  description,
  actions,
}: {
  crumbs: BreadcrumbItem[];
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <>
      <Breadcrumb items={crumbs} Link={NavAnchor} />
      <NoticeBanner />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 ref={ref} tabIndex={-1} className="text-page-title outline-none">
            {title}
          </h1>
          {description ? <p className="text-body text-fg-muted">{description}</p> : null}
        </div>
        {actions}
      </div>
    </>
  );
}

export function Section({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card aria-labelledby={id} className="gap-3">
      <CardHeader>
        <CardTitle as="h2" id={id}>
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      {children}
    </Card>
  );
}

export function SettingList({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col divide-y divide-line">{children}</ul>;
}

export function SettingRow({
  icon,
  tone = "info",
  title,
  caption,
  status,
  action,
}: {
  icon: LucideIcon;
  tone?: TileTone;
  title: string;
  caption: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 first:pt-0 last:pb-0">
      <IconTile icon={icon} tone={tone} />
      <div className="flex min-w-[10rem] flex-1 flex-col">
        <span className="text-body-strong text-fg">{title}</span>
        <span className="text-caption text-fg-subtle">{caption}</span>
      </div>
      {status}
      {action}
    </li>
  );
}

export function StatusPill({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <Badge tone={tone}>{children}</Badge>;
}
