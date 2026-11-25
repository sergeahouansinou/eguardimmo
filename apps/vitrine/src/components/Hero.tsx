import type { ReactNode } from "react";
import { Container } from "./Container";

interface HeroProps {
  eyebrow: string;
  title: string;
  lead: string;
  actions?: ReactNode;
  decoration?: boolean;
}

const BLOCKS = ["bg-action-hover", "bg-accent", "bg-action", "bg-action-pressed", "bg-info-line", "bg-action-pressed", "bg-accent/60", "bg-action"];

export function Hero({ eyebrow, title, lead, actions, decoration = false }: HeroProps) {
  return (
    <section className="on-dark bg-nav text-fg-inverse">
      <Container className="flex flex-wrap items-center gap-10 py-12 md:py-16">
        <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-4">
          <p className="text-caption font-semibold tracking-wider text-nav-active uppercase">{eyebrow}</p>
          <h1 className="text-balance text-display md:text-hero">{title}</h1>
          <p className="max-w-[56ch] text-lead text-nav-fg">{lead}</p>
          {actions ? <div className="flex flex-wrap gap-3 pt-2">{actions}</div> : null}
        </div>
        {decoration ? (
          <div aria-hidden="true" className="grid min-w-0 flex-[1_1_16rem] grid-cols-4 gap-2.5">
            {BLOCKS.map((tone, index) => (
              <div key={index} className={`aspect-square rounded-md ${tone}`} />
            ))}
          </div>
        ) : null}
      </Container>
    </section>
  );
}
