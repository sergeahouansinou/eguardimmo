"use client";

import { cx } from "@eguardimmo/ui";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { COPYRIGHT, LEGAL_LINKS } from "@/lib/legal";

export function LegalLinks() {
  return (
    <nav
      aria-label="Informations légales"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-line pt-3 text-center text-caption text-fg-subtle"
    >
      {LEGAL_LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm font-medium text-action-on-subtle underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {link.label}
        </a>
      ))}
      <span>{COPYRIGHT}</span>
    </nav>
  );
}

export interface AuthCardProps {
  label: string;
  children: ReactNode;
  centered?: boolean;
  legal?: boolean;
  className?: string;
}

export function AuthCard({ label, children, centered = false, legal = true, className }: AuthCardProps) {
  return (
    <section
      aria-label={label}
      className={cx(
        "mx-auto flex w-full max-w-[420px] min-w-0 flex-col gap-4 rounded-lg border border-line border-t-4 border-t-accent bg-surface p-4 sm:p-6",
        centered && "items-center text-center",
        className,
      )}
    >
      {children}
      {legal ? <LegalLinks /> : null}
    </section>
  );
}

export function AuthHeading({ title, description, focus = false }: { title: string; description?: ReactNode; focus?: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    <div className="flex flex-col gap-1">
      <h1 ref={ref} className="text-page-title outline-none" tabIndex={-1}>
        {title}
      </h1>
      {description ? <p className="text-body text-fg-muted">{description}</p> : null}
    </div>
  );
}
