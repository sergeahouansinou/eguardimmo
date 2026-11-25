"use client";

import { cx, Icon } from "@eguardimmo/ui";
import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";
import type { FaqEntry } from "@/content/faq";

interface FaqAccordionProps {
  entries: readonly FaqEntry[];
  headingLevel: 2 | 3;
}

export function FaqAccordion({ entries, headingLevel }: FaqAccordionProps) {
  const baseId = useId();
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set([0]));
  const Heading = headingLevel === 2 ? "h2" : "h3";

  const toggle = (index: number) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="flex min-w-0 flex-col border-b border-line">
      {entries.map((entry, index) => {
        const expanded = open.has(index);
        const buttonId = `${baseId}-q${String(index)}`;
        const panelId = `${baseId}-r${String(index)}`;
        return (
          <div key={entry.question} className="border-t border-line">
            <Heading className="text-value">
              <button
                id={buttonId}
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => { toggle(index); }}
                className={cx(
                  "flex min-h-11 w-full items-center justify-between gap-3 rounded-sm py-3 text-left font-semibold text-fg",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                )}
              >
                <span>{entry.question}</span>
                <Icon icon={expanded ? Minus : Plus} size={20} />
              </button>
            </Heading>
            <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!expanded}>
              <p className="max-w-[64ch] pb-4 text-prose text-fg-muted">{entry.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
