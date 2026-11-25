import { cx } from "@eguardimmo/ui";
import type { ReactNode } from "react";
import { Container } from "./Container";

interface SectionProps {
  id?: string;
  title: string;
  titleId: string;
  tone?: "page" | "surface";
  intro?: ReactNode;
  children: ReactNode;
}

export function Section({ id, title, titleId, tone = "page", intro, children }: SectionProps) {
  return (
    <section id={id} aria-labelledby={titleId} className={cx("py-12 md:py-16", tone === "surface" ? "bg-surface" : "bg-page")}>
      <Container className="flex flex-col gap-6">
        <div className="flex max-w-3xl flex-col gap-3">
          <h2 id={titleId} className="text-balance text-display text-fg">
            {title}
          </h2>
          {intro ? <p className="text-lead text-fg-muted">{intro}</p> : null}
        </div>
        {children}
      </Container>
    </section>
  );
}
