"use client";

import { Card, CardHeader, CardTitle, cx } from "@eguardimmo/ui";
import { useId } from "react";
import type { ReactNode } from "react";

export interface SectionProps {
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Section({ title, aside, className, children }: SectionProps) {
  const id = useId();
  return (
    <Card role="region" aria-labelledby={id} className={cx("px-4 py-3", className)}>
      <CardHeader className="flex-wrap">
        <CardTitle as="h2" id={id}>
          {title}
        </CardTitle>
        {aside}
      </CardHeader>
      {children}
    </Card>
  );
}

export function StatGrid({ columns = 4, children }: { columns?: 3 | 4; children: ReactNode }) {
  return (
    <div className={cx("grid grid-cols-1 gap-3 sm:grid-cols-2", columns === 4 ? "lg:grid-cols-4" : "sm:grid-cols-3")}>
      {children}
    </div>
  );
}

export function Split({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">{children}</div>;
}

export function Pair({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">{children}</div>;
}

export function Caption({ children }: { children: ReactNode }) {
  return <span className="text-caption text-fg-subtle">{children}</span>;
}
