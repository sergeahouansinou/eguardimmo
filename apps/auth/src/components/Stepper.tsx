import { Check } from "lucide-react";
import { Icon, cx } from "@eguardimmo/ui";

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol aria-label="Étapes" className="flex flex-wrap items-center gap-4">
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} aria-current={active ? "step" : undefined} className="flex items-center gap-2 text-body text-fg-muted">
            <span
              className={cx(
                "flex size-6 items-center justify-center rounded-full text-caption font-semibold",
                active ? "bg-action text-on-action" : done ? "bg-success text-success-fg" : "bg-muted text-fg-muted",
              )}
            >
              {done ? <Icon icon={Check} size={14} /> : index + 1}
            </span>
            <span className={cx(active && "font-semibold text-fg")}>{label}</span>
            {done ? <span className="sr-only">terminée</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
